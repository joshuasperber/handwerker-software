"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  BOOKING_STEPS,
  formatCurrency,
  formatDateTime,
  formatSlotLabel,
  PRIORITY_LABELS,
} from "@/lib/utils";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Upload,
  Loader2,
  Wrench,
  MapPin,
  AlertCircle,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";

interface CustomServiceInput {
  name: string;
  description: string;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number | null;
  questions: {
    id: string;
    question: string;
    type: string;
    options: unknown;
    isRequired: boolean;
  }[];
}

interface Tenant {
  name: string;
  phone: string | null;
  primaryColor: string;
  privacyPolicyUrl: string | null;
}

interface TimeSlot {
  start: string;
  end: string;
  employeeId?: string;
}

type Priority = "NORMAL" | "DRINGEND" | "NOTFALL";

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [step, setStep] = useState(0);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState<CustomServiceInput[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [photos, setPhotos] = useState<File[]>([]);
  const [address, setAddress] = useState({ street: "", zipCode: "", city: "" });
  const [addressValid, setAddressValid] = useState<{ inArea: boolean; message: string } | null>(null);
  const [contact, setContact] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/public/booking/services?tenant=${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setTenant(data.data.tenant);
          setServices(data.data.services);
        }
      });
  }, [slug]);

  const validateAddress = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/public/booking/validate-address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: slug, zipCode: address.zipCode }),
    });
    const data = await res.json();
    if (data.success) setAddressValid(data.data);
    setLoading(false);
  }, [slug, address.zipCode]);

  const loadSlots = useCallback(async () => {
    if (!addressValid?.inArea || selectedServices.length === 0) return;
    setLoading(true);
    const res = await fetch("/api/public/booking/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant: slug,
        serviceIds: selectedServices,
        zipCode: address.zipCode,
      }),
    });
    const data = await res.json();
    if (data.success) setSlots(data.data.slots);
    setLoading(false);
  }, [slug, selectedServices, address.zipCode, addressValid?.inArea]);

  useEffect(() => {
    // Adressprüfung mit bewusstem Lade-Indikator; Ergebnis folgt asynchron.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (step === 2 && address.zipCode.length >= 4) validateAddress();
  }, [step, address.zipCode, validateAddress]);

  useEffect(() => {
    // Slot-Abruf mit bewusstem Lade-Indikator; Ergebnis folgt asynchron.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (step === 3 && addressValid?.inArea) loadSlots();
  }, [step, addressValid, loadSlots]);

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function addCustomService() {
    setCustomServices((prev) => [...prev, { name: "", description: "" }]);
  }
  function updateCustomService(index: number, patch: Partial<CustomServiceInput>) {
    setCustomServices((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }
  function removeCustomService(index: number) {
    setCustomServices((prev) => prev.filter((_, i) => i !== index));
  }

  const namedCustomServices = customServices.filter((c) => c.name.trim());
  const hasCatalogService = selectedServices.length > 0;

  function validateStep(): boolean {
    const e: Record<string, string> = {};
    if (step === 0 && selectedServices.length === 0 && namedCustomServices.length === 0)
      e.services = "Bitte wählen Sie mindestens eine Leistung oder erfassen Sie eine sonstige Leistung.";
    if (step === 2) {
      if (!address.street) e.street = "Bitte geben Sie Ihre Straße ein.";
      if (!address.zipCode || address.zipCode.length < 4) e.zipCode = "Bitte geben Sie eine gültige PLZ ein.";
      if (!address.city) e.city = "Bitte geben Sie Ihren Ort ein.";
    }
    if (step === 3 && addressValid?.inArea && hasCatalogService && !selectedSlot) e.slot = "Bitte wählen Sie einen Termin.";
    if (step === 4) {
      if (!contact.firstName) e.firstName = "Bitte geben Sie Ihren Vornamen ein.";
      if (!contact.lastName) e.lastName = "Bitte geben Sie Ihren Nachnamen ein.";
      if (!contact.email) e.email = "Bitte geben Sie Ihre E-Mail ein.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function nextStep() {
    if (!validateStep()) return;
    setStep((s) => s + 1);
  }

  async function submitBooking() {
    if (!gdprConsent) {
      setErrors({ gdpr: "Bitte bestätigen Sie die Datenschutzerklärung." });
      return;
    }
    setLoading(true);

    const bookingData = {
      serviceIds: selectedServices,
      customServices: namedCustomServices.map((c) => ({
        name: c.name,
        description: c.description || undefined,
      })),
      ...contact,
      ...address,
      description,
      questionAnswers: answers,
      priority,
      gdprConsent: true as const,
      ...(selectedSlot
        ? { slotStart: selectedSlot.start, slotEnd: selectedSlot.end, employeeId: selectedSlot.employeeId }
        : {}),
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify({ tenant: slug, ...bookingData }));
    photos.forEach((photo, i) => formData.append(`photo${i}`, photo));

    try {
      const res = await fetch("/api/public/booking/requests", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setOrderNumber(data.data.orderNumber);
        setStep(6);
      } else {
        setErrors({ submit: data.error ?? "Buchung fehlgeschlagen. Bitte versuchen Sie es erneut." });
      }
    } catch {
      setErrors({ submit: "Verbindungsfehler. Bitte prüfen Sie Ihre Internetverbindung." });
    } finally {
      setLoading(false);
    }
  }

  const selectedServiceObjects = services.filter((s) => selectedServices.includes(s.id));
  const allQuestions = selectedServiceObjects.flatMap((s) =>
    s.questions.map((q) => ({ ...q, serviceName: s.name }))
  );

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafb]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0d5c63]" />
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center px-4">
        <Card className="max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900">Vielen Dank!</h2>
          <p className="text-slate-600 mt-2">
            Ihre Anfrage wurde erfolgreich übermittelt.
          </p>
          <p className="mt-4 text-lg font-semibold text-[#0d5c63]">{orderNumber}</p>
          {selectedSlot && (
            <p className="text-slate-600 mt-2">Termin: {formatDateTime(selectedSlot.start)}</p>
          )}
          <p className="text-sm text-slate-500 mt-4">
            Sie erhalten in Kürze eine Bestätigung per E-Mail.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafb] flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0d5c63] text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900">{tenant.name}</h1>
            <p className="text-sm text-slate-500">Termin online buchen – schnell & unkompliziert</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-1">
          {BOOKING_STEPS.map((label, i) => (
            <div key={label} className="flex flex-col items-center flex-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  i < step ? "bg-[#0d5c63] text-white" : i === step ? "bg-[#0d5c63] text-white ring-2 ring-[#0d5c63]/30" : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < step ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className="mt-1 text-[10px] text-slate-500 hidden sm:block text-center leading-tight">{label}</span>
            </div>
          ))}
        </div>

        <Card>
          {step === 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Welche Leistung benötigen Sie?</h2>
              {services.map((service) => (
                <label
                  key={service.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors ${
                    selectedServices.includes(service.id)
                      ? "border-[#0d5c63] bg-[#0d5c63]/5"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input type="checkbox" checked={selectedServices.includes(service.id)} onChange={() => toggleService(service.id)} className="mt-1" />
                  <div className="flex-1">
                    <p className="font-medium">{service.name}</p>
                    {service.description && <p className="text-sm text-slate-500 mt-1">{service.description}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                      ca. {service.durationMinutes} Min.
                      {service.priceCents ? ` · ab ${formatCurrency(service.priceCents)}` : ""}
                    </p>
                  </div>
                </label>
              ))}

              <div className="rounded-xl border border-dashed border-slate-300 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">Sonstige Leistung</p>
                    <p className="text-xs text-slate-500">Nicht aufgeführt? Beschreiben Sie Ihr Anliegen frei – wir melden uns mit einem Vorschlag.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addCustomService}>
                    <Plus className="h-4 w-4 mr-1" /> Hinzufügen
                  </Button>
                </div>
                {customServices.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {customServices.map((c, i) => (
                      <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <Input
                            label="Bezeichnung"
                            className="flex-1"
                            value={c.name}
                            onChange={(e) => updateCustomService(i, { name: e.target.value })}
                            placeholder="z. B. Sonderwunsch / Beratung"
                          />
                          <button type="button" onClick={() => removeCustomService(i)} className="text-red-500 mt-7 shrink-0" aria-label="Entfernen">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <Textarea
                          label="Beschreibung (optional)"
                          value={c.description}
                          onChange={(e) => updateCustomService(i, { description: e.target.value })}
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {errors.services && <p className="text-sm text-red-600">{errors.services}</p>}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Problem beschreiben</h2>
              <Textarea
                label="Was ist passiert? Was soll erledigt werden?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="z. B. Küchenabfluss verstopft seit 2 Tagen..."
              />
              {allQuestions.map((q) => (
                <div key={q.id}>
                  <p className="text-xs text-slate-400 mb-1">{q.serviceName}</p>
                  {q.type === "SELECT" && Array.isArray(q.options) ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{q.question}</label>
                      <select
                        className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        required={q.isRequired}
                      >
                        <option value="">Bitte wählen...</option>
                        {(q.options as string[]).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <Input label={q.question} required={q.isRequired} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                  )}
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dringlichkeit</label>
                <div className="flex flex-wrap gap-2">
                  {(["NORMAL", "DRINGEND", "NOTFALL"] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium border-2 transition-colors ${
                        priority === p
                          ? p === "NOTFALL" ? "border-red-500 bg-red-50 text-red-700" : p === "DRINGEND" ? "border-yellow-500 bg-yellow-50 text-yellow-800" : "border-[#0d5c63] bg-[#0d5c63]/5 text-[#0d5c63]"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
                {priority === "NOTFALL" && tenant.phone && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    Bei Notfällen rufen Sie uns direkt an: {tenant.phone}
                  </p>
                )}
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 hover:border-[#0d5c63]/50 transition-colors">
                <Upload className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-500">Fotos hochladen (optional)</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
              </label>
              {photos.length > 0 && <p className="text-sm text-slate-600">{photos.length} Foto(s) ausgewählt</p>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#0d5c63]" /> Einsatzadresse
              </h2>
              <Input label="Straße & Hausnummer" required value={address.street} error={errors.street}
                onChange={(e) => setAddress({ ...address, street: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="PLZ" required value={address.zipCode} error={errors.zipCode}
                  onChange={(e) => setAddress({ ...address, zipCode: e.target.value })} />
                <Input label="Ort" required value={address.city} error={errors.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              </div>
              {loading && <Loader2 className="h-5 w-5 animate-spin text-[#0d5c63]" />}
              {addressValid && (
                <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${addressValid.inArea ? "bg-green-50 text-green-800" : "bg-yellow-50 text-yellow-800"}`}>
                  {addressValid.inArea ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                  {addressValid.message}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Termin wählen</h2>
              {!addressValid?.inArea ? (
                <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
                  Da Ihre Adresse außerhalb unseres Einsatzgebiets liegt, nehmen wir Ihre Anfrage entgegen und melden uns mit einem Terminvorschlag bei Ihnen.
                </div>
              ) : !hasCatalogService ? (
                <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                  Für Ihre sonstige Leistung schlagen wir Ihnen passende Termine telefonisch oder per E-Mail vor. Sie können die Anfrage direkt absenden.
                </div>
              ) : loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#0d5c63]" /></div>
              ) : slots.length === 0 ? (
                <p className="text-slate-500">Aktuell keine freien Termine verfügbar. Bitte kontaktieren Sie uns telefonisch.</p>
              ) : (
                <div className="grid gap-2 max-h-72 overflow-y-auto">
                  {slots.slice(0, 8).map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-xl border-2 p-4 text-left transition-colors ${
                        selectedSlot?.start === slot.start ? "border-[#0d5c63] bg-[#0d5c63]/5" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-medium">{formatSlotLabel(slot.start, slot.end)}</span>
                    </button>
                  ))}
                </div>
              )}
              {errors.slot && <p className="text-sm text-red-600">{errors.slot}</p>}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Ihre Kontaktdaten</h2>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Vorname" required value={contact.firstName} error={errors.firstName}
                  onChange={(e) => setContact({ ...contact, firstName: e.target.value })} />
                <Input label="Nachname" required value={contact.lastName} error={errors.lastName}
                  onChange={(e) => setContact({ ...contact, lastName: e.target.value })} />
              </div>
              <Input label="E-Mail" type="email" required value={contact.email} error={errors.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              <Input label="Telefon" type="tel" value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Zusammenfassung prüfen</h2>
              <div className="rounded-xl bg-slate-50 p-4 space-y-2 text-sm">
                <p><strong>Leistung:</strong> {[...selectedServiceObjects.map((s) => s.name), ...namedCustomServices.map((c) => `${c.name} (sonstige)`)].join(", ")}</p>
                <p><strong>Adresse:</strong> {address.street}, {address.zipCode} {address.city}</p>
                {selectedSlot && <p><strong>Termin:</strong> {formatDateTime(selectedSlot.start)}</p>}
                {!selectedSlot && <p><strong>Termin:</strong> Rückmeldung durch unser Büro</p>}
                <p><strong>Kontakt:</strong> {contact.firstName} {contact.lastName}, {contact.email}</p>
                {description && <p><strong>Beschreibung:</strong> {description}</p>}
                <p><strong>Dringlichkeit:</strong> {PRIORITY_LABELS[priority]}</p>
              </div>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={gdprConsent} onChange={(e) => setGdprConsent(e.target.checked)} className="mt-1" />
                <span className="text-sm text-slate-600">
                  Ich willige in die Verarbeitung meiner Daten gemäß DSGVO ein.
                  {tenant.privacyPolicyUrl && (
                    <> <a href={tenant.privacyPolicyUrl} className="text-[#0d5c63] underline" target="_blank" rel="noreferrer">Datenschutzerklärung</a></>
                  )}
                </span>
              </label>
              {(errors.gdpr || errors.submit) && (
                <p className="text-sm text-red-600">{errors.gdpr ?? errors.submit}</p>
              )}
            </div>
          )}
        </Card>
      </div>

      <footer className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-4">
        <div className="mx-auto max-w-2xl flex justify-between gap-3">
          <Button variant="outline" size="touch" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          {step < 5 ? (
            <Button variant="action" size="touch" onClick={nextStep}>
              Weiter <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button variant="action" size="touch" onClick={submitBooking} disabled={loading}>
              {loading ? "Wird gesendet..." : "Anfrage absenden"}
            </Button>
          )}
        </div>
        <div className="mx-auto max-w-2xl mt-3 flex justify-between text-xs text-slate-400">
          {tenant.phone && (
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Notfall: {tenant.phone}</span>
          )}
          {tenant.privacyPolicyUrl && (
            <Link href={tenant.privacyPolicyUrl} className="hover:text-slate-600">Datenschutz</Link>
          )}
        </div>
      </footer>
    </div>
  );
}

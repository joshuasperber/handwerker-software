import { prisma } from "./prisma";

function isZipInArea(zip: string, zipFrom: string, zipTo: string): boolean {
  const zipNum = parseInt(zip, 10);
  const fromNum = parseInt(zipFrom, 10);
  const toNum = parseInt(zipTo, 10);
  if (isNaN(zipNum) || isNaN(fromNum) || isNaN(toNum)) {
    return zip >= zipFrom && zip <= zipTo;
  }
  return zipNum >= fromNum && zipNum <= toNum;
}

export async function validateServiceArea(
  tenantId: string,
  zipCode: string
): Promise<{ inArea: boolean; message: string }> {
  const serviceAreas = await prisma.serviceArea.findMany({ where: { tenantId } });

  if (serviceAreas.length === 0) {
    return { inArea: true, message: "Wir sind in Ihrer Region im Einsatz." };
  }

  const inArea = serviceAreas.some((area) =>
    isZipInArea(zipCode, area.zipFrom, area.zipTo)
  );

  if (inArea) {
    return { inArea: true, message: "Gute Nachricht: Wir sind in Ihrer Region im Einsatz." };
  }

  return {
    inArea: false,
    message:
      "Ihre PLZ liegt leider außerhalb unseres Einsatzgebiets. Sie können trotzdem eine Anfrage stellen – wir melden uns bei Ihnen.",
  };
}

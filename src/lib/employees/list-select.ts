/** Schlanke Mitarbeiter-Liste — ohne Passwort-Hash und ohne Avatar-Blobs. */
export const employeeListInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      phone: true,
      address: true,
      isActive: true,
      canManageRoles: true,
    },
  },
  qualifications: { select: { id: true, name: true } },
  workingHours: true,
} as const;

const geheugen = new Map<string, string>();
const lees = (k: string) => {
  try {
    return localStorage.getItem(`logboek:${k}`) ?? geheugen.get(k);
  } catch {
    return geheugen.get(k);
  }
};
const schrijf = (k: string, v: string) => {
  geheugen.set(k, v);
  try {
    localStorage.setItem(`logboek:${k}`, v);
  } catch {
    /* alleen in het geheugen */
  }
};

/** Cookie-opslag vervangen door browseropslag (per kijker). */
export async function cookies() {
  return {
    get: (naam: string) => {
      const value = lees(naam);
      return value === undefined || value === null ? undefined : { name: naam, value };
    },
    set: (naam: string, waarde: string) => schrijf(naam, waarde),
  };
}

export type ApolloContact = {
  name: string;
  title: string;
  email: string;
  linkedin_url: string;
  company: string;
};

const SEARCH_URL = "https://api.apollo.io/v1/mixed_people/search";
const MATCH_URL = "https://api.apollo.io/v1/people/match";

function normalizePerson(p: any, fallbackCompany: string): ApolloContact {
  const name =
    [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() ||
    p?.name ||
    "";
  return {
    name,
    title: p?.title ?? "",
    email: p?.email ?? "",
    linkedin_url: p?.linkedin_url ?? "",
    company: p?.organization?.name ?? fallbackCompany,
  };
}

export async function searchPeople(
  company: string,
  titles: string[],
): Promise<ApolloContact[]> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        api_key: key,
        q_organization_name: company,
        person_titles: titles,
        per_page: 5,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const people = Array.isArray(data?.people) ? data.people : [];
    return people.map((p: any) => normalizePerson(p, company));
  } catch {
    return [];
  }
}

export async function enrichPerson(
  name: string,
  company: string,
): Promise<ApolloContact | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(MATCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        api_key: key,
        name,
        organization_name: company,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.person) return null;
    return normalizePerson(data.person, company);
  } catch {
    return null;
  }
}

export function formatContactsForContext(contacts: ApolloContact[]): string {
  if (!contacts.length) return "";
  return contacts
    .map((c, i) => {
      const fields = [
        c.name || "(nom?)",
        c.title || "(titre?)",
        c.email || "(email?)",
        c.linkedin_url || "(linkedin?)",
      ];
      return `[Apollo ${i + 1}] ${fields.join(" — ")}`;
    })
    .join("\n");
}

export const DEFAULT_DECISION_MAKER_TITLES = [
  "CTO",
  "Chief Technology Officer",
  "Directeur Technique",
  "Head of Technology",
  "Technical Director",
  "Responsable Accessibilité",
];

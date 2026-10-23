// Where the Pure Signal card's "Leave a message" form posts: a Cloudflare
// Worker (workers/contact-form at the repo root) that emails each message on
// through Cloudflare Email Routing.

export const CONTACT_EMAIL = "williamkeffer2005@gmail.com";

export const CONTACT_ENDPOINT = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT || "https://keffer-contact.williamkeffer2005.workers.dev";

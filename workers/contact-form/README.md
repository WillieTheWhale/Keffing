# keffer-contact

The Cloudflare Worker behind the "Leave a message" form on the Pure Signal
card (keffer-portfolio/components/background/LeaveMessage.tsx). It emails each
message to the address in `wrangler.toml` through Cloudflare Email Routing.

Needs, in the Cloudflare account that owns keffer.cafe:
- Email Routing enabled on keffer.cafe, with williamkeffer2005@gmail.com added
  and verified as a destination address;
- this Worker deployed. Cloudflare Workers Builds is connected to the repo
  (keffer-contact > Settings > Builds: branch main, root directory
  workers/contact-form, watch path workers/contact-form/*), so a push to main
  that touches this folder redeploys it; by hand: `npx wrangler deploy` from
  this folder after `npx wrangler login`.

The site's endpoint is `CONTACT_ENDPOINT` in keffer-portfolio/lib/contact.ts.
Allowed page origins are `ALLOWED_ORIGINS` in `wrangler.toml`.

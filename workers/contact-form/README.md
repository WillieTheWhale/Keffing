# keffer-contact

The Cloudflare Worker behind the "Leave a message" form on the Pure Signal
card (keffer-portfolio/components/background/LeaveMessage.tsx). It emails each
message to the address in `wrangler.toml` through Cloudflare Email Routing.

Needs, in the Cloudflare account that owns keffer.cafe:
- Email Routing enabled on keffer.cafe, with williamkeffer2005@gmail.com added
  and verified as a destination address;
- this Worker deployed. Pushes to main that touch this folder deploy it
  through GitHub Actions (.github/workflows/deploy-worker.yml, which needs the
  CLOUDFLARE_API_TOKEN repository secret); by hand: `npx wrangler deploy` from
  this folder after `npx wrangler login`.

The site's endpoint is `CONTACT_ENDPOINT` in keffer-portfolio/lib/contact.ts.
Allowed page origins are `ALLOWED_ORIGINS` in `wrangler.toml`.

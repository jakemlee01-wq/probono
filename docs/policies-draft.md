# Policy drafts for owner review

These are plain-language starting points, not legal advice and not reviewed by a lawyer. Nothing here is published. The app shows "Not yet published" until the owners approve final text and set `POLICIES_PUBLISHED=yes`.

Open questions for the owners are marked **Decide**.

## Terms of use (draft)

- probono is a free pilot that introduces Twin Cities nonprofits to volunteers for short, scoped accounting and finance projects.
- Volunteering is unpaid. It doesn't create an employment, contractor, or professional-services relationship with probono or between the parties.
- Volunteers don't act as the nonprofit's accountant of record and don't perform regulated work through probono, such as preparing or signing tax returns or issuing audit opinions.
- Each project follows the work agreement both sides accept in the app. Either side can stop a project at any time.
- probono doesn't verify credentials unless a badge says exactly what was reviewed, and doesn't guarantee anyone's work.
- **Decide:** who operates the pilot (named people or an entity), governing law, limitation of liability wording, and minimum age (suggest 18+).

## Privacy notice (draft)

What we collect: account email and password (through Supabase Auth); profile and organization details you enter; photos you upload; postings; interest messages; project records (work agreements, acceptances with times, messages, hours, check-ins, links, team names and emails you add); notifications; blocks and reports; short-lived rate-limit counters keyed by account id or a hash of a network address.

Who can see it: profiles, photos, and postings are visible to pilot participants who fit your terms. Project records are visible only to the two sides. Reports are visible only to the pilot team. Photos are stored at public web addresses.

Processors: Supabase (database, authentication, file storage), GitHub Pages (website hosting), Google Fonts (font delivery). No advertising or analytics.

Deletion: you can delete your account in Profile, Account. Your profile, postings, photos, and sign-in are removed. Project records the other side relies on are kept with your name replaced by "Deleted account". Safety reports are kept.

**Decide:** retention periods for closed projects, reports, and rate-limit counters (suggest: rate counters 30 days, closed projects 3 years, reports 3 years after resolution); a contact for privacy requests; whether to add a scheduled cleanup job.

## Community guidelines (draft)

Matches the "Community guidelines" page in the app. **Decide:** consequences for breaking them (warning, restriction, removal) and who decides.

## Confidentiality acknowledgment (in the work agreement)

Current wording each side accepts: "I'll keep the other side's information confidential, use it only for this project, and return or delete it when the project ends." The app says plainly that this pilot acknowledgment isn't a complete legal agreement. **Decide:** whether a short written volunteer agreement or NDA is needed for projects with system access.

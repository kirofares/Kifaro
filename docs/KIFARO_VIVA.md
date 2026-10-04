# KIFARO Viva pilot

Viva belongs inside the existing KIFARO React application. Website and Capacitor
apps can share the lecture route, account, design and future assessment service.
The initial pilot is available at
`#/anatomate/lecture/introduction-to-anatomy/viva` and from the lecture page.
Native applications bundle the web code and need a new build/release to include it.

## Delivered in this first increment

- Five written recall questions from the existing Introduction to Anatomy lecture.
- English/Arabic prompts, optional hints, source excerpts and a learner checklist.
- Original responses remain visible and cannot be changed after the key is revealed.
- A review session repeats missed points and questions answered with a hint.
- Resume/delete browser-local progress, isolated by account and deck version.
- Clear self-assessment labeling. This is neither AI grading nor a validated exam.

The pilot is free and does not call an AI provider, collect audio, charge a
subscription, unlock protected files, or change existing video view allowances.
An account change remounts the session so answers cannot carry into another
account's UI. Browser-local data is not encrypted; users can delete it, and it
does not sync across devices. Guests share the guest storage area of that browser.

## Content provenance

Source: `AnatoMate_Lecture_01_Introduction_to_Anatomy.pptx`, the user's September
29, 2026 copy, inspected October 4, 2026. Five questions adapt slides 3, 5, 6, 7,
9 and the wrist/elbow quick check on slide 12. The source filename and section
are shown with every key. Source slide numbers refer to that exact edition;
the protected site's current PDF is not assumed to use the same pagination.
No lecture image or full deck is republished by this feature.

Before expanding, the teacher should review these adapted prompts and keys.
Additional decks need actual lecture sources, clear source versions, reference
pages and suitable rights for any visual. Do not invent keys from objectives.

## Next increment: an actual AI examiner

1. Add a server-side authenticated assessment endpoint and reviewed question bank.
   Reuse KIFARO identity; store provider credentials only on the server. Keep
   each student's sessions private, with server-enforced access and rate limits.
2. Grade against explicit lecture criteria, return cited feedback and indicate
   uncertainty. Treat student answers as untrusted input. Never award credit
   by a keyword-only check. Compare the service against teacher-marked examples
   in Arabic and English before enabling scores for students.
3. Add optional speech transcription, let students correct the transcript,
   then assess it. State the audio retention policy and avoid saving recordings
   by default. Cross-platform microphone behavior needs device testing.
4. Add protected, reviewed image spotters and follow-up questions, then server
   history, spaced review and an admin question editor.
5. Pilot with a small student group, measure completion, return usage, teacher
   agreement and cost per completed session. Set paid usage limits only after
   measuring provider cost. The earlier 199 EGP price is a hypothesis, not an
   activated subscription.

## Checks

`npm run test:viva` exercises blank-answer guards, immutable submitted answers,
full completion, retry selection, storage validation and account namespacing.
Run `npm run typecheck` and `npm run build` as normal. On-device keyboard, RTL
layout and resume flows still require visual/device review before broad rollout.

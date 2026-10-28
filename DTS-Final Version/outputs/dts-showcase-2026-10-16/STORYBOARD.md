---
format: 1920x1080
duration: 1920s
message: Staff can follow responsibility and record each document action from registration to release in DTS.
arc: Orientation to one document journey to supporting modules to measured proof to staff practice
audience: DTS staff supervisors focals and managers
mode: autonomous
language: Taglish
---

# DTS Staff Showcase Storyboard

## Global direction

Use a readable desktop capture and one persistent hero tracking number. Narration and the three matching capture beats live in SCRIPT.md and showcase-plan.json. All 32 keyframes contain authentic reference stills from a disposable stress-test copy with planned editorial overlays. Separate samples illustrate stages; the final lifecycle recording should follow one tracking number. This package is the requested script and storyboard handoff.

Format is 16:9 at 1920x1080. Thirty frames per second is sufficient for interface recordings. Each scene occupies a one-minute planning slot with three twenty-second capture beats; use smaller editorial cuts within the beats only after an action completes. Keep a held result for at least three seconds. Retiming follows the recorded narration, never artificial speeding through a form.

Brand tokens come from public/app.css: teal #0E5A63 for emphasis, dark sidebar #0D2A30, paper #F1F4F5, white cards, green #1E7A54 for successful results, amber #8F5D00 for due-soon context and red #B03333 for genuine overdue states. Source interface typography is Public Sans and IBM Plex Mono; use local system-font fallbacks in this planning sheet. Do not recolor or rearrange operational controls in captured product footage.

Use authentic screen capture for all product text and results. Generic generated footage, if later requested, is limited to a clearly separate opening or closing context shot. Never use generated product screens to imply a completed action. Reserve the lower 17 percent for two-line captions; keep a lower-third clear of form controls. Suggested narration is warm and instructional; music, if later selected, remains quiet under speech. No voice or music asset is locked in this planning package.

## Review state

All scenes are outline status. The HTML frames combine real reference screens and planned editorial framing. Timecodes are estimates until narration and recordings are locked. HyperFrames usage is unknown because the CLI is unavailable in the local cache. No video-generation or rendering job is part of this deliverable.

## Frame 1 - Ano ang kayang sagutin ng DTS

- status: outline
- src: boards/scene-01.html
- duration: 60s
- transition_in: cut
- scene: Nasaan na ang document at sino ang kikilos
- voiceover: Kapag may nagtanong kung nasaan na ang isang document, ano ang una nating ginagawa? Hinahanap ba natin ang huling message, tumatawag sa ibang desk, o chine-check ang isang listahang hindi na updated? Sa Document Tracking and Routing System, may isang record na susundan natin mula pagtanggap, assignment, processing at review, hanggang clearance at release. Makikita kung kanino ang current action at ano ang susunod na hakbang. Sa demo na ito, actual screens at sample records ang gagamitin natin. Ipapakita rin ang regular reports, personnel schedules, monitoring tools at administrative controls na sumusuporta sa araw-araw na trabaho.
- timecode: 00:00-01:00
- route: #/dashboard
- actor: Presenter

1. Show the actual Department overview; hold a sample tracking number in an editorial callout.
2. Highlight current desk, deadline and status on one sample record.
3. Show the chapter roadmap; keep the same document identifier through the lifecycle scenes.

Production constraint: Use a clearly labelled demonstration record. Do not invent a reduced processing time or savings figure.

## Frame 2 - Sino ang gumagamit at ano ang responsibilidad

- status: outline
- src: boards/scene-02.html
- duration: 60s
- transition_in: cut
- scene: Tamang account para sa tamang action
- voiceover: May magkakaibang responsibilidad ang bawat account. Ang Admin Staff ang nagla-log, nagfo-forward at nagre-record ng release. Ang Focal ang nag-aassign. Ang Staff ang nagpoproseso at nagsusumite ng output. Ang Supervisor at Division Manager ang nagre-review sa kani-kanilang bahagi. Ang Department Manager ang nasa final review at clearance, kasama ang mga applicable acting at OIC rules. Ang System Administrator naman ang namamahala sa accounts, permissions at configuration. Hindi ito ang regular processing account at wala itong My work queue. Gagamit tayo ng tamang enrolled account sa bawat operational step.
- timecode: 01:00-02:00
- route: #/users
- actor: Presenter and role cast

1. Show seven role labels around the document; use verified enrolled names only in the cast panel.
2. Trace the ordinary sequence Admin Staff to Focal to Staff to reviewers.
3. Separate System Administrator from the operational chain.

Production constraint: Permissions and desk responsibility both matter. A configured focal also receives focal abilities even when their base role differs.

## Frame 3 - Sign in at personal workspace

- status: outline
- src: boards/scene-03.html
- duration: 60s
- transition_in: cut
- scene: Sariling account at malinaw na workspace
- voiceover: Mag-sign in gamit ang sariling approved account. Kung temporary password ang ibinigay sa first use, sundin ang prompt para palitan ito. Huwag gumamit ng shared administrator account para sa normal na processing. Pagkapasok, ang Staff ay karaniwang dadalhin sa My work. Ang administrators at managers ay sa Department overview. Kung may binuksang direct document link, puwedeng iyon ang unang destination. Sa account menu, makikita ang personal options gaya ng password change, theme at sign out. Puwedeng pumili ng light, dark o automatic theme. Takpan ang password habang nire-record at huwag isama ang actual credentials sa final video.
- timecode: 02:00-03:00
- route: /
- actor: Any enrolled staff account

1. Capture splash to sign-in; type the approved demo account with password masked.
2. Cut to staff My work, then a manager overview from a separate browser context.
3. Open the account menu and show theme choices and sign-out location.

Production constraint: Use a fresh test profile. Do not publish the stress password or initial-credentials file.

## Frame 4 - Pagkilala sa navigation at My work

- status: outline
- src: boards/scene-04.html
- duration: 60s
- transition_in: cut
- scene: Unahin ang records na naghihintay sa iyo
- voiceover: Ang sidebar ang mapa ng application. Nandito ang Department overview, My work kapag applicable, CMED, CMSD, Personnel Schedule, Insights at mga administration pages na pinapayagan sa account. Sa My work, makikita ang ordinary documents at Special Reports na nangangailangan ng action mula sa naka-sign-in na user. Ang bilang sa queue ay para makatulong sa pag-prioritize, kaya tingnan din ang deadline at current stage. May in-app action indicator at bell para sa pending work. Ang ibang pagbabago ay lumalabas sa live refresh, karaniwang sa loob ng humigit-kumulang fifteen seconds. Ipakita ang actual queue; huwag ilarawan itong email o text-message notification service.
- timecode: 03:00-04:00
- route: #/action
- actor: Staff and administrator comparison

1. Pan through visible sidebar groups in the staff account.
2. Open My work; point to an ordinary document and a Special Report action card.
3. Show the bell and a staged update from another account; allow time for refresh.

Production constraint: Open dialogs and unsaved forms can defer refresh. Keep the demonstration free of unsaved edits.

## Frame 5 - Department overview at paghahanap ng records

- status: outline
- src: boards/scene-05.html
- duration: 60s
- transition_in: cut
- scene: Hanapin at i-filter bago mag-follow up
- voiceover: Sa Department overview, puwedeng makita ang monitored documents, ongoing work, action required, Overdue Stay at cleared records. Ang mga tile ay filters na puwedeng piliin para mas mapaliit ang listahan. Mag-search gamit ang tracking number, subject o originating office. Pagkatapos, gamitin ang division, priority at available advanced filters, saka ang sorting at pagination. Puwede ring pumili ng columns at mag-save ng sariling view. Tandaan na ang Overdue Stay ay kasama ang overdue deadlines at applicable stalled desk records. Hindi lahat ng nandito ay pare-pareho ang dahilan ng delay. Buksan ang record para makita kung deadline ba o desk stay ang kailangang aksiyunan.
- timecode: 04:00-05:00
- route: #/dashboard
- actor: Admin Staff or manager

1. Click total, ongoing and Overdue Stay tiles on the populated registry.
2. Search the hero record; show More filters, sorting, columns and page controls.
3. Save a named view and reopen it; point to the distinct delay labels.

Production constraint: Saved views and registry preferences are per account and browser. Avoid claiming that they sync across devices.

## Frame 6 - Preview at pagbabasa ng document details

- status: outline
- src: boards/scene-06.html
- duration: 60s
- transition_in: cut
- scene: Status at current desk muna bago mag-action
- voiceover: Kung gusto munang sumilip nang hindi iniiwan ang listahan, gamitin ang Preview in drawer. Makikita ang key details at available actions, at puwedeng lumipat sa previous o next record sa kasalukuyang queue. Sa full document page, unahin ang status, responsible desk, deadline, desk age at next action. Nasa record din ang source, document type, division, priority at iba pang registration details. Sa ibaba, tingnan ang Files and links, review comments at movement history. Ang history ang magpapakita kung ano ang nangyari at sino ang gumawa ng action. Kapag may tanong sa progress, dito tayo bumabalik sa halip na manghula mula sa title lang.
- timecode: 05:00-06:00
- route: #/dashboard then #/doc/{id}
- actor: Any signed-in user with applicable actions

1. Enable drawer preview and open the hero record from the registry.
2. Highlight summary fields, then Open full document.
3. Scroll to files, comments and history; return to the current action panel.

Production constraint: Some details are broadly viewable; an available view does not grant permission to perform every action.

## Frame 7 - Pag-log ng bagong document

- status: outline
- src: boards/scene-07.html
- duration: 60s
- transition_in: cut
- scene: Maayos na registration ang simula ng tracking
- voiceover: Magsimula tayo sa bagong ordinary document. Ilagay ang date received, communication type, received from, reference number at malinaw na subject. Piliin ang document type at target division, saka ang Normal o Urgent priority. Kung may original document sa approved file storage, ilagay ang complete web link. Puwede ring maglagay ng pages at remarks. I-review muna ang details bago i-save; tutulungan ng validation na mahuli ang kulang o invalid na input. May choice na i-save muna sa Admin desk o i-forward kung handa na. May generated tracking number ang record. Para sa ordinary assignment-based processing, ang simpleng registration pa lang ay hindi pa pagsisimula ng processing clock.
- timecode: 06:00-07:00
- route: New document form
- actor: Marian Grace Paling / Admin Staff

1. Open New document as mpaling; enter a synthetic letter with a meaningful subject.
2. Fill current active references and a safe demonstration file URL; show one required-field validation.
3. Save without forwarding; show received status, generated tracking number and unstarted clock.

Production constraint: Hero record: DEMO Site inspection coordination request, CMED. Urgent is a label, not a separate automatic deadline rule.

## Frame 8 - Forwarding at assignment ng Focal

- status: outline
- src: boards/scene-08.html
- duration: 60s
- transition_in: cut
- scene: Assignment ang simula ng applicable processing clock
- voiceover: Kapag kumpleto na ang intake details, i-forward ang ordinary document sa configured division focal. Magbabago ang current desk at status, at magkakaroon ng bagong movement entry. Sa Focal account, piliin ang transaction type, i-confirm ang document type at italaga ang active staff na magpoproseso. Sa example natin, si Danezel Christian Cruz ang assignee. Dito nagsisimula ang applicable assignment-based clock. Ang due date ay galing sa configured rules. May transactions na nangangailangan ng special date kapag walang prescribed document-type deadline. Ang For information only ay para sa eligible focal assignment. Sundin ang available options sa actual form, hindi isang memorized na fixed deadline.
- timecode: 07:00-08:00
- route: #/doc/{id}
- actor: Admin Staff then Aubrey Camille C Cabrera / Focal

1. Forward the hero record as mpaling; show at_focal in history.
2. Switch to acabrera and assign to dcruz using an appropriate active transaction type.
3. Point to processing status, assignee, clock start and computed deadline.

Production constraint: Use the current configured threshold. Record exact account switches as separate takes; do not make one shared admin account impersonate the whole chain.

## Frame 9 - Pag-unawa sa deadlines at desk limits

- status: outline
- src: boards/scene-09.html
- duration: 60s
- transition_in: cut
- scene: Deadline at desk stay ay magkaibang sukatan
- voiceover: Hindi iisang deadline ang para sa lahat. Puwedeng prescribed working days, calendar days, o reporting-period basis ang document type. May transaction-based deadline din kapag iyon ang applicable fallback. Sa working-day calculations, may epekto ang weekends at configured holidays. Iba rin ang due soon, due today at overdue. Kapag walang applicable deadline, ipapakita iyon nang hiwalay sa record na hindi pa nagsisimula ang clock. Bukod sa document deadline, may Admin at Focal desk limits para makita ang sobrang tagal sa isang desk. Kaya mahalagang basahin ang label at context. Ang Urgent priority ay hindi automatic na nagpapalit sa deadline rule.
- timecode: 08:00-09:00
- route: #/doc/{id} and Reference lists
- actor: Presenter and Focal

1. Compare labelled examples: unstarted, no deadline, on time, due soon, due today and overdue.
2. Show a document-type basis and the Holidays reference tab without changing production values.
3. Contrast deadline age with current-desk age using two populated test records.

Production constraint: Use visible dates from the recording day. Label examples rather than promising a particular due date for every document.

## Frame 10 - Staff processing at Files and links

- status: outline
- src: boards/scene-10.html
- duration: 60s
- transition_in: cut
- scene: Ihanda ang output at isumite sa tamang reviewer
- voiceover: Sa Staff account, lalabas sa My work ang assigned document. Buksan ito at i-check ang instructions, deadline at source bago gumawa ng output. Ang DTS ang tracking record ng trabaho at review history. Sa Files and links, puwedeng ilagay ang original, draft at revised file links ayon sa authority ng user. Ang actual files ay nasa linked storage. Hindi ito direct file upload o isang built-in document editor. Kapag handa na ang draft, i-submit para sa review at piliin ang tamang eligible reviewer. Sa example, ang supervisor ni Cruz ay si Maria Urduja Jean Tabilas. Maglagay ng maikling context para mas malinaw kung ano ang kailangang tingnan ng reviewer.
- timecode: 09:00-10:00
- route: #/action then #/doc/{id}
- actor: Danezel Christian G Cruz / Staff

1. Sign in as dcruz and open the hero record from My work.
2. Save a draft link; point out original, draft and revised link sections.
3. Submit to mtabilas and show the supervisor-review status.

Production constraint: A link change and revision counter are not historical file-version storage. Opening external previews depends on the linked service and browser rules.

## Frame 11 - Review comments at compliance cycle

- status: outline
- src: boards/scene-11.html
- duration: 60s
- transition_in: cut
- scene: Malinaw na comments at dokumentadong compliance
- voiceover: Sa Supervisor account, may dalawang karaniwang resulta: puwedeng i-approve ang draft o ibalik sa staff para sa compliance. Kapag ibabalik, ilagay ang malinaw at actionable na comments. Makikita ng assigned Staff ang comments sa record. Gawin ang correction, i-update ang revised file link kung kailangan, at ilarawan kung paano na-address ang request bago mag-resubmit. Naiiwan sa record ang compliance cycle at history. Ang resubmission behavior ay nakadepende sa configured policy, halimbawa kung babalik sa returning reviewer o magsisimula muli sa supervisor review. Sa demo, ipakita ang actual destination pagkatapos mag-submit.
- timecode: 10:00-11:00
- route: #/doc/{id}
- actor: Supervisor then assigned Staff

1. As mtabilas, return the hero document with one specific supporting-checklist comment.
2. As dcruz, add a revised link and a concrete compliance response.
3. Resubmit; show resolved comments, cycle count and the configured returning stage.

Production constraint: Resubmission resolves outstanding review comments together; do not imply individual per-comment resolution buttons.

## Frame 12 - Division review at clearance

- status: outline
- src: boards/scene-12.html
- duration: 60s
- transition_in: cut
- scene: Cleared for Out ay hiwalay sa release
- voiceover: Kapag maayos na ang output, itutuloy ng Supervisor ang document sa Division Manager. Mula roon, mapupunta ito sa Department review para sa final assessment at clearance. Puwede pa ring may return for compliance sa applicable review stage. Kung cleared na, i-record ang clearance gamit ang tamang authorized account. Sa ordinary example natin, si Myles Martinez ang CMED Division Manager at si Oscar Hanova ang Department Manager. Mahalagang distinction ito: ang Cleared for Out ay hindi pa ang actual release. Humihinto ang applicable processing clock sa clearance, pero may hiwalay pang log-out step para ma-record kung kailan at kanino inilabas ang document.
- timecode: 11:00-12:00
- route: #/doc/{id}
- actor: Supervisor then Division Manager then Department Manager

1. Approve as mtabilas, then approve as mmartinez; show each status transition.
2. Clear as ohanova and hold the Cleared for Out state.
3. Compare clearance timestamp with the still-empty release fields.

Production constraint: The live engine includes authorized early-clear/override cases. Present the standard sequence without claiming every review step is universally mandatory.

## Frame 13 - Reassignment at return to sender

- status: outline
- src: boards/scene-13.html
- duration: 60s
- transition_in: cut
- scene: Magkaiba ang compliance at return to sender
- voiceover: May mga pagkakataong kailangang ilipat ang processing sa ibang eligible staff. Sa allowed stage at account, gamitin ang reassignment at maglagay ng context. Mananatili ang movement history ng naging responsibility. Iba naman ang return for compliance sa instruction na ibalik ang document sa sender. Sa return-to-sender path, maglalagay ang authorized reviewer ng reason at mapupunta ang document sa For return na naghihintay ng Admin log out. Gumamit tayo ng hiwalay na sample para hindi mawala ang main example. Tingnan ang status, reason at next responsible desk bago magpatuloy. Walang generic cancel o reopen button na dapat ipakita bilang kasalukuyang feature.
- timecode: 12:00-13:00
- route: #/doc/{alternate-id}
- actor: Focal or eligible manager and Admin Staff

1. Use a separate processing record to reassign between two current eligible staff.
2. Use another allowed record to enter an authorized return-to-sender instruction with a reason.
3. Show return_out and its Admin release step beside the compliance example.

Production constraint: Show manager/override labels if used. Do not claim that reassignment always requires a reason field or resets the deadline.

## Frame 14 - Actual release at routing slip

- status: outline
- src: boards/scene-14.html
- duration: 60s
- transition_in: cut
- scene: Release na may petsa recipient at history
- voiceover: Bumalik tayo sa cleared document. Sa Admin Staff account, ilagay kung kanino ito ire-release at ang applicable remarks. Kapag na-log out, may release timestamp, releasing user at destination na ang record. Mananatiling searchable ang released document. Makikita pa rin ang registration details, comments at movement history. Puwede ring mag-print ng routing slip para sa record ng naging proseso. May selected-record tools para sa print at CSV, at may eligible batch forwarding at log out. Basahin ang confirmation dahil may records na puwedeng ma-skip. Ang batch log out ay gumagamit ng original sender bilang recipient at current time, kaya individual release ang gamitin kapag iba-iba ang actual destination.
- timecode: 13:00-14:00
- route: #/doc/{id} and registry batch controls
- actor: Admin Staff

1. Log out the hero record individually as mpaling with a specific demonstration destination.
2. Open its movement history and print routing slip preview.
3. Show batch controls on separate eligible test records and read the confirmation without deleting records.

Production constraint: Bulk deletion is administrator-controlled and optional to explain verbally; never demonstrate it against real records.

## Frame 15 - Consolidated CMR and PPR

- status: outline
- src: boards/scene-15.html
- duration: 60s
- transition_in: cut
- scene: Reporting period at designation ang gabay
- voiceover: May espesyal na registration flow ang Consolidated CMR and PPR. Pipiliin ang region o office at reporting period, dahil ang responsibility ay galing sa configured report designation. Kapag na-log ang reporting-period document, dumidiretso ito sa designated active staff at nilalampasan ang ordinary focal-assignment step. Ang division para sa bagong record ay galing sa configured assignee kapag identifiable ang division niya. Ang deadline ay kino-compute mula sa document-type rule para sa reporting period. Ang starting rule para sa consolidated report ay sixth working day ng kasunod na buwan, pero puwedeng baguhin ng administrator ang configuration. Sa Regular Reports, makikita ang regions at status ng kanilang submissions.
- timecode: 14:00-15:00
- route: #/cmed/regular
- actor: Admin Staff and designated regional staff

1. Open CMED Regular Reports and the consolidated-report tab.
2. Create a sample for a configured region and reporting month; show designated staff and automatic routing.
3. Highlight the computed deadline and a region drilldown.

Production constraint: Confirm the current prescribed threshold before filming; do not narrate the default six days as an immutable rule.

## Frame 16 - CMED at CMSD reporting views

- status: outline
- src: boards/scene-16.html
- duration: 60s
- transition_in: cut
- scene: Division reports ayon sa responsible personnel
- voiceover: May magkahiwalay na destination ang CMED at CMSD. Ang default ay List of Documents. Sa CMED, may Regular Reports din; ang available performance tab ay Turnaround Time and On-Time Rate para sa account na may report permission. Ang reporting ownership ay sumusunod sa responsible personnel. Kaya mahalaga ang tamang assignment at division ng user. Ang shared report na walang isang identifiable division ay hindi isinasama sa individual division metrics. Ang division access ay chine-check din ng server. Pero hindi nito ibig sabihin na confidential na ang lahat ng underlying documents sa Department overview. Ihiwalay natin ang access sa division destination, permission na mag-action, at policy sa pagtingin ng basic records.
- timecode: 15:00-16:00
- route: #/cmed and #/cmsd/performance
- actor: Authorized division user or department account

1. Open CMED List of Documents, then CMED Regular Reports.
2. Open CMSD and show its document list and performance tab; do not add a CMSD Regular Reports tab.
3. Show a permitted account and a denied direct division route in separate takes.

Production constraint: This is reporting scope, not blanket record confidentiality. Keep this qualification in the spoken script.

## Frame 17 - Pag-configure ng Special Reports

- status: outline
- src: boards/scene-17.html
- duration: 60s
- transition_in: cut
- scene: Recurring reports na may malinaw na schedule
- voiceover: Para sa recurring obligations, may Special Reports schedules. Sa Reference lists, puwedeng itakda ang report name, frequency, reporting months, generation day, deadline threshold at responsible people o division focals. Available ang monthly, quarterly, specific months at annual schedules. Ang generation ay para sa reporting period na natapos, at ang configured generation day ay nasa kasunod na buwan. Ipakita natin ang isang malinaw na monthly example. Dapat may eligible responsible person bago i-activate ang schedule. Ang initial starter schedules ay inactive at unassigned. Hindi sapat na may report name lang; kailangang kumpleto ang configuration at responsibility para makabuo ng tamang assignment.
- timecode: 16:00-17:00
- route: Reference lists > Special Reports
- actor: Administrator with configuration permission

1. Open Reference lists, Special Reports, Schedules.
2. Show monthly, quarterly, specific-month and annual choices, generation day and working-day threshold.
3. Assign current staff on a disposable schedule and show the active-state validation.

Production constraint: Do not activate or change real recurring schedules while recording. Search supports enrolled names, roles and divisions.

## Frame 18 - Generated Special Reports at review workflow

- status: outline
- src: boards/scene-18.html
- duration: 60s
- transition_in: cut
- scene: Auto generation ay simula ng obligation
- voiceover: Kapag due na ang schedule, ang server ang gumagawa ng report at assignment. Chine-check ito sa startup at periodically; may catch-up para sa missed generation dates at may protection laban sa duplicate obligation para sa parehong schedule at period. Sa assigned staff account, lalabas ang report sa My work. Dadaan ito sa submission, review, possible compliance, clearance at log out. Nananatili ang assignment history kahit may allowed reassignment bago pumasok sa review. May Special Report tab sa regular reporting area at kasama ang generated records sa relevant monitoring. Ang generation ay hindi automatic submission ng report content. Ang staff pa rin ang kailangang gumawa ng output at kumpletuhin ang review process.
- timecode: 17:00-18:00
- route: CMED Regular Reports > Special Report / My work
- actor: Assigned staff and reviewers

1. Show an existing generated report with period, deadline and responsible staff.
2. Open it from My work; demonstrate one submission and compliance example.
3. Show generated-report assignment history and a released report in reporting.

Production constraint: Do not claim automatic Drive folders, email delivery or Personnel Schedule events. The generator uses configured working-day deadlines.

## Frame 19 - Personnel Schedule para sa availability

- status: outline
- src: boards/scene-19.html
- duration: 60s
- transition_in: cut
- scene: I-check ang availability at conflicts
- voiceover: Bukod sa documents, may Personnel Schedule para sa inspections, leave at meetings. Ang personnel ay mula rin sa enrolled user accounts, kaya hindi na kailangan ng hiwalay na pangalanan ulit ang parehong staff. May Month, Week, Day at Agenda views. Puwedeng mag-filter at tingnan ang date range at mga taong kasali. Ang pag-add, edit at delete ay para sa account na may schedule-management permission. Kapag may overlapping activity para sa parehong tao, may conflict warning. Puwedeng i-review ng authorized user at i-confirm ang Save anyway. Ang leave ay whole-day availability; hindi nito automatic na pinapalitan ang OIC o document assignee.
- timecode: 18:00-19:00
- route: #/schedule
- actor: Viewer then user with schedule management permission

1. Show all four calendar views and a personnel filter.
2. Create one test inspection, leave entry and meeting; show shared participants.
3. Trigger an overlap warning, explain confirmation, then show the saved schedule details.

Production constraint: Inspection project is free text with suggestions from prior entries, not a separate project-management module. No automatic leave-to-OIC linkage.

## Frame 20 - Analytics at tamang pagbasa ng metrics

- status: outline
- src: boards/scene-20.html
- duration: 60s
- transition_in: cut
- scene: Basahin ang date basis bago mag-compare
- voiceover: Sa Insights, buksan ang Analytics at piliin ang reporting period at division. Makikita ang document volume, open at finished work, on-time rate, average turnaround at supporting breakdowns. May kahulugan ang bawat date basis. Ang receipt cohort ay batay sa date received. Ang released-in-period ay batay sa release date, kahit mas maaga natanggap ang document. Ang current backlog ay open records ngayon mula sa lahat ng receipt dates. Ang turnaround na ipinapakita ay working days mula assignment hanggang clearance, hindi simpleng receipt-to-dispatch time. Basahin din ang cohort at threshold bago mag-compare ng staff o division. Hindi natin tatawaging productivity score ang isang number na walang context.
- timecode: 19:00-20:00
- route: #/analytics
- actor: User with report permission

1. Open Analytics and set a visible month range and division.
2. Highlight the receipt, release and current-backlog KPI notes.
3. Point to turnaround and on-time labels, then staff/document/transaction breakdown tables.

Production constraint: Finished metrics can include records with a stopped clock at clearance. Retain the distinction from final release.

## Frame 21 - Charts at drilldown sa actual records

- status: outline
- src: boards/scene-21.html
- duration: 60s
- transition_in: cut
- scene: Mula summary papunta sa matching documents
- voiceover: Sa Charts, mas madaling makita ang volume by month, received at released records, finished on time o late, status mix at deadline health. May view rin ng workload at time sa current desk. Kapag may malaking overdue o desk-age group, puwedeng piliin ang applicable chart bar o desk para buksan ang matching registry records. Nananatili ang relevant reporting filters para may malinaw na koneksiyon ang chart at underlying list. Gamitin natin ang drilldown para mag-verify. Hindi sapat ang mataas na bar lang; tingnan kung anong documents ang nasa likod nito, sino ang current assignee, at anong action ang kailangan. Mas nagiging specific ang follow-up kapag record-level na ang usapan.
- timecode: 20:00-21:00
- route: #/graphs
- actor: User with report permission

1. Show monthly volume, status mix, deadline health and staff workload.
2. Click an age band or desk and inspect the filtered registry.
3. Open one matching document, then return to the selected chart context.

Production constraint: Some charts show the selected receipt cohort while release totals use release dates. Keep visible period labels in every capture.

## Frame 22 - Print CSV at selected outputs

- status: outline
- src: boards/scene-22.html
- duration: 60s
- transition_in: cut
- scene: I-verify ang scope bago mag-share
- voiceover: Kung kailangan ng offline copy o supporting list para sa meeting, may print at CSV tools sa relevant pages. Sa registry, puwedeng current filtered records o selected records ang output, depende sa kasalukuyang selection. May routing slip para sa document history, registry printout, analytics summary, division performance output at chart printing. I-check ang heading, period, division at record count bago mag-print o mag-share. Ang exported CSV ay para sa spreadsheet analysis; hindi ito CSV import feature. Kapag may selection, siguraduhing iyon talaga ang gustong i-export. Ipakita natin ang preview at file contents para makita na tugma ang output sa scope na pinili.
- timecode: 21:00-22:00
- route: Registry / Analytics / Charts / Audit
- actor: User with print and export permission

1. Filter the registry and export a CSV; verify headers, count and scope.
2. Show a routing slip, analytics print preview and a division-performance export.
3. Show chart print and audit output controls only under authorized accounts.

Production constraint: A printable chart page may depend on browser print settings. Do not portray exports as automatic scheduled distribution.

## Frame 23 - Users roles at division focals

- status: outline
- src: boards/scene-23.html
- duration: 60s
- transition_in: cut
- scene: Configuration na nakaaapekto sa actual work
- voiceover: Sa Users, makikita ang enrolled accounts, role, division, active state at last sign-in information. Ang administrator ang may control sa account creation, maintenance at password reset ayon sa available permissions. Sa Roles and permissions, nakikita kung anong actions ang pinapayagan sa bawat role. May desk conditions pa rin: halimbawa, assignment para sa tamang focal at submission para sa assigned staff. Ang System Administrator ay may broad administrative authority. Sa Divisions and focals, itinatakda kung sino ang receiving focal ng bawat division. Hindi dapat basta i-deactivate ang configured focal nang walang kapalit. Ang changes sa role at assignment ay dapat sinasadya, dahil nakaaapekto ang mga ito sa queues, routing at reporting ownership.
- timecode: 22:00-23:00
- route: #/users > #/roles > #/divisions
- actor: System Administrator

1. Open the current 18-account roster; highlight role/division/active columns.
2. Show the permission matrix without changing real permissions.
3. Open Divisions and focals and show the current CMED/CMSD focal mappings.

Production constraint: Explain account deactivation and reset verbally or in an isolated copy. General viewing policy is distinct from action permissions.

## Frame 24 - Delegation presence at OIC

- status: outline
- src: boards/scene-24.html
- duration: 60s
- transition_in: cut
- scene: Malinaw na authority kapag may absent
- voiceover: Kapag wala ang usual approving manager, may Delegation and OIC page para makita ang configured availability at final-review responsibility. Nandito ang manager presence at nominated OIC. Ang resolver ay tumitingin sa present Department Manager, applicable Division Managers at enabled eligible OIC ayon sa current rules. May authorized clearance paths din sa operational engine, kaya sundin ang actual account permissions at action panel. Manually maintained ang manager presence at OIC setup. Hindi ito automatic na ine-enable dahil lang may leave entry sa Personnel Schedule, at walang automatic delegation-expiry workflow na dapat i-assume. Sa demo, ibalik ang test configuration pagkatapos ipakita ang fallback.
- timecode: 23:00-24:00
- route: #/delegation
- actor: Manager and authorized OIC administrator

1. Show the current final-review responsibility banner.
2. On a disposable copy, demonstrate present/away states and OIC nomination/enable controls.
3. Restore original test presence/OIC settings and point back to the applicable document action.

Production constraint: Avoid claiming that all clearance is universally blocked whenever a manager is away; existing authorized exceptions must remain explicit.

## Frame 25 - Reference lists at business rules

- status: outline
- src: boards/scene-25.html
- duration: 60s
- transition_in: cut
- scene: Dito nanggagaling ang maraming operational rules
- voiceover: Sa Reference lists nakalagay ang options at rules na paulit-ulit ginagamit sa system. Kasama ang Transactions, Document types, Communication types, Leave types, Holidays, Report designations at Special Reports. Sa document types, puwedeng i-configure ang prescribed threshold, unit at deadline basis. Sa report designations, itinatakda ang responsible staff ng bawat region o office. Sa holidays, nakasalalay ang working-day calculations. Ang active o inactive na state ay mahalaga para sa bagong entries at historical records. May dependency checks sa ilang ginagamit nang references. Bago magbago ng business rule, i-review ang epekto at sundin ang authorized configuration process.
- timecode: 24:00-25:00
- route: #/refs
- actor: User with configuration permission

1. Walk through all seven Reference list tabs with their actual labels.
2. Open a document-type dialog; highlight threshold, basis, unit and active state.
3. Show Holidays and Report designations, then a protected used-reference example on the test copy.

Production constraint: Do not delete historical references for cosmetic cleanup. Changes generally govern subsequent computation/generation rather than rewriting all historical workflow records.

## Frame 26 - Settings at everyday usability

- status: outline
- src: boards/scene-26.html
- duration: 60s
- transition_in: cut
- scene: Mas malinaw na feedback sa araw-araw na use
- voiceover: Sa System Admin Settings, may office name, tracking prefix, inactivity timeout, due-soon threshold, desk limits, resubmission policy at cursor particle trail. Ang mga ito ay system behavior settings na kailangang i-review bago i-save. Sa ordinary use, may keyboard shortcuts, responsive tables, clear saving feedback at protection kapag may unsaved changes. May focus handling sa dialogs para mas maayos ang keyboard navigation. Puwedeng itoggle ang decorative cursor effect, at may respect ito sa reduced-motion preference. Ang theme at saved registry preferences ay browser-level conveniences. Ang system settings naman ay server-saved at lumalabas sa ibang users sa normal refresh cycle.
- timecode: 25:00-26:00
- route: #/settings and account menu
- actor: Administrator and ordinary staff comparison

1. Show each settings field without changing the live configuration.
2. Open keyboard shortcuts; show an unsaved-change prompt on a disposable form.
3. Show light/dark theme and reduced-motion-friendly cursor settings briefly.

Production constraint: Keep cursor effects subtle in the recording. Do not claim a formal accessibility certification.

## Frame 27 - Audit log para sa traceability

- status: outline
- src: boards/scene-27.html
- duration: 60s
- transition_in: cut
- scene: Document history at system activity may sariling view
- voiceover: Bukod sa movement history ng isang document, may Audit log para sa system activity. Kasama rito ang sign-ins, document actions at administrative changes na nire-record ng server. Puwedeng mag-search ng relevant entries at gumamit ng available print o export controls. Ang screen ay nagpapakita ng latest matching entries sa supported limit; hindi ito unlimited full-history search sa bawat lumang event. Para sa isang concern, magsimula sa document history, saka i-correlate sa audit entry kung kailangan. May user, time, action at detail para mas madaling ma-review ang nangyari. Hindi natin ilalarawan itong tamper-proof compliance certification o legal electronic-signature system.
- timecode: 26:00-27:00
- route: #/audit
- actor: User with audit permission

1. Search the audit log using the hero tracking number or a distinctive action detail.
2. Point to timestamp, user, action and detail columns.
3. Compare one audit action with the hero document movement entry; show export permission.

Production constraint: Current audit query searches a recent server-side window and displays up to 200 matches. Use current visible labels rather than claiming unlimited audit retention.

## Frame 28 - Backup restore at recovery

- status: outline
- src: boards/scene-28.html
- duration: 60s
- transition_in: cut
- scene: Backup ay kailangan ding ma-verify
- voiceover: May administrator tools para sa full JSON backup at restore. Naka-include ang core configuration at supported records, kaya iba ito sa isang filtered CSV report. Sa restore, vini-validate ang supplied data at may recovery copy bago palitan ang stored state. Sa server, may daily SQLite backups at retention para sa recent backup files. Kailangan pa rin ng approved off-machine backup routine. Sa showcase, ipapakita natin ang controls at prepared results sa isolated test copy. Hindi tayo magre-restore o mag-clear ng real records habang nagpe-present. Pagkatapos ng authorized recovery, i-verify ang users, documents, schedules, reports at ability na mag-sign in.
- timecode: 27:00-28:00
- route: #/settings > Settings and data
- actor: Administrator with data permission

1. Show Backup and Restore controls, keeping reset/clear actions visually separate.
2. Use a labelled test-only insert showing valid restore and rejected invalid restore results.
3. Show recovered counts and successful sign-in from the stress-test evidence.

Production constraint: Backups contain sensitive application/account data. Use approved storage; do not expose backup contents or password hashes in footage.

## Frame 29 - Workflow Designer at simulation

- status: outline
- src: boards/scene-29.html
- duration: 60s
- transition_in: cut
- scene: Draft validate publish at simulate
- voiceover: May visual Workflow Designer para gumawa at mag-review ng workflow definitions. Puwedeng maglagay ng Start, Action, Decision at End, ayusin ang connectors, labels, properties at layout, at mag-save ng draft. May validation, versioning, publish at simulation. Sa simulation, puwedeng gumamit ng sample document at makita ang branch path at candidate responsibility nang hindi binabago ang actual document workflow. Sa current version, ang designer ay para sa drafting, publishing at simulation. Ang live document actions ay gumagamit pa rin ng existing operational engine; hindi pa enabled ang generic designer execution. Kaya huwag nating sabihing automatic nang magro-route ang documents dahil lang na-publish ang diagram.
- timecode: 28:00-29:00
- route: #/workflow
- actor: System Administrator

1. Open a prepared draft with Start, Action, Decision and End; show properties and connector labels.
2. Show Arrange, fit, zoom, minimap, undo/redo, save state and a version selector.
3. Run validation and read-only simulation; place a visible current-scope label beside the result.

Production constraint: Label the scene Designer and simulation. Do not animate a notification node as if it actually sends email or changes live assignments.

## Frame 30 - Security deployment at practical boundaries

- status: outline
- src: boards/scene-30.html
- duration: 60s
- transition_in: cut
- scene: Server checked actions at controlled deployment
- voiceover: Sa operational side, server-checked ang sign-in at action permissions. May hashed password storage, protected session cookie, failed-login throttling at configurable inactivity timeout. Ang account deactivation at password reset ay may session effects. Para sa real deployment, kailangan ang HTTPS at maayos na server access at backup setup. Ang staff ay bumubukas ng browser sa approved DTS address; ang shared database ay nasa server. May malinaw ding current boundaries: external file links ang ginagamit, walang direct binary upload, walang built-in email reminder service, at hindi parallel workflow execution ang kasalukuyang operational flow. Ang mga ito ay planning considerations, hindi features na dapat idagdag sa demonstration graphics.
- timecode: 29:00-30:00
- route: Sign-in / settings / architecture visual
- actor: Presenter

1. Use a simple labelled browser-to-server diagram, not an invented cloud integration dashboard.
2. Show security controls conceptually without exposing keys, cookies or stored hashes.
3. Present three current boundaries as small factual labels beside real screen captures.

Production constraint: Avoid absolute claims such as impossible to hack, fully compliant or encrypted file storage. Session and permission controls do not establish blanket division confidentiality.

## Frame 31 - Performance proof gamit ang stress test

- status: outline
- src: boards/scene-31.html
- duration: 60s
- transition_in: cut
- scene: 6000 documents at measured results
- voiceover: May hiwalay tayong stress-test launcher para makita ang behavior ng DTS sa mas maraming records. Sa verified run noong October sixteen, twenty twenty-six, may six thousand documents, twelve hundred schedules at two hundred forty-one Special Reports pagkatapos ng scenario checks. Kasama ang eighteen enrolled accounts, two thousand eight hundred eighty account-stage-action probes at one hundred fifty thousand four hundred eighty reference combinations. Pumasa rin ang twenty-four maintained regression suites. Sa thirty concurrent full-state requests, ang measured p95 latency ay about two point nine seconds, with zero HTTP errors sa load measurements. Resulta ito sa tested machine at workload, hindi guarantee ng unlimited capacity. Ipakita ang dated report at actual measurements para malinaw ang context.
- timecode: 30:00-31:00
- route: Port 3500 / saved report.html
- actor: Presenter and stress-test operator

1. Open the saved PASS report; show the dated dataset and account count.
2. Show the action-matrix and reference-combination totals plus maintained-suite results.
3. Highlight the 30-request p95 row, zero errors, resource figures and original-data comparison.

Production constraint: p95 is not average or per-user screen time. Distinguish 30 concurrent requests from six concurrent enrolled-role browser sessions. Earlier development latency reached 3.37 seconds.

## Frame 32 - Recap at guided staff practice

- status: outline
- src: boards/scene-32.html
- duration: 60s
- transition_in: cut
- scene: Mag-practice gamit ang tamang account
- voiceover: Balikan natin ang ordinary flow: log, forward, assign, process, review, comply kung kailangan, clear at release. Sa bawat step, may current responsibility at history na puwedeng balikan. Para sa daily work, magsimula sa My work, i-check ang deadline at instructions, panatilihing tama ang file links, at magbigay ng malinaw na comments o compliance response. Para sa monitoring, gamitin ang filters at drilldowns bago magbigay ng conclusion. Ang susunod nating activity ay isang guided practice sa approved test environment. Bawat role ay gagawa ng sariling step sa isang sample document. Pagkatapos, i-check natin kung tugma ang final status, recipient at movement history. Mula rito, puwede nang pag-usapan ang rollout questions at actual office procedures.
- timecode: 31:00-32:00
- route: #/dashboard and #/action
- actor: Presenter

1. Return to the same hero record now released; show a concise chronological path.
2. Show the role-based practice checklist and the test-environment label.
3. Hold a simple closing frame with the proposed next activity; leave space for questions.

Production constraint: Leave the CTA actionable and internal. Do not invent deployment dates, sponsor endorsements or a public support contact.

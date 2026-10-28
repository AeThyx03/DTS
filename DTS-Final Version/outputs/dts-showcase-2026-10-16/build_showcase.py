from pathlib import Path
import json, csv, re, math, html, shutil, textwrap, hashlib
from datetime import date

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ASSETS = OUT / 'assets'
ASSETS.mkdir(exist_ok=True)
SCENES = []

def scene(title, chapter, role, route, vo, actions, overlay, layout, note, refs):
    n = len(SCENES) + 1
    SCENES.append(dict(id=f'S{n:02}', title=title, chapter=chapter, role=role, route=route,
        duration=60, voiceover=vo, actions=actions, overlay=overlay, layout=layout,
        presenter_note=note, evidence=refs))

scene('Ano ang kayang sagutin ng DTS', 'Orientation', 'Presenter', '#/dashboard', [
    'Kapag may nagtanong kung nasaan na ang isang document, ano ang una nating ginagawa? Hinahanap ba natin ang huling message, tumatawag sa ibang desk, o chine-check ang isang listahang hindi na updated?',
    'Sa Document Tracking and Routing System, may isang record na susundan natin mula pagtanggap, assignment, processing at review, hanggang clearance at release. Makikita kung kanino ang current action at ano ang susunod na hakbang.',
    'Sa demo na ito, actual screens at sample records ang gagamitin natin. Ipapakita rin ang regular reports, personnel schedules, monitoring tools at administrative controls na sumusuporta sa araw-araw na trabaho.'
], ['Show the actual Department overview; hold a sample tracking number in an editorial callout.', 'Highlight current desk, deadline and status on one sample record.', 'Show the chapter roadmap; keep the same document identifier through the lifecycle scenes.'], 'Nasaan na ang document at sino ang kikilos', 'hero', 'Use a clearly labelled demonstration record. Do not invent a reduced processing time or savings figure.', ['E01','E02','E03'])

scene('Sino ang gumagamit at ano ang responsibilidad', 'Orientation', 'Presenter and role cast', '#/users', [
    'May magkakaibang responsibilidad ang bawat account. Ang Admin Staff ang nagla-log, nagfo-forward at nagre-record ng release. Ang Focal ang nag-aassign. Ang Staff ang nagpoproseso at nagsusumite ng output.',
    'Ang Supervisor at Division Manager ang nagre-review sa kani-kanilang bahagi. Ang Department Manager ang nasa final review at clearance, kasama ang mga applicable acting at OIC rules.',
    'Ang System Administrator naman ang namamahala sa accounts, permissions at configuration. Hindi ito ang regular processing account at wala itong My work queue. Gagamit tayo ng tamang enrolled account sa bawat operational step.'
], ['Show seven role labels around the document; use verified enrolled names only in the cast panel.', 'Trace the ordinary sequence Admin Staff to Focal to Staff to reviewers.', 'Separate System Administrator from the operational chain.'], 'Tamang account para sa tamang action', 'roles', 'Permissions and desk responsibility both matter. A configured focal also receives focal abilities even when their base role differs.', ['E01','E02','E10'])

scene('Sign in at personal workspace', 'Orientation', 'Any enrolled staff account', '/', [
    'Mag-sign in gamit ang sariling approved account. Kung temporary password ang ibinigay sa first use, sundin ang prompt para palitan ito. Huwag gumamit ng shared administrator account para sa normal na processing.',
    'Pagkapasok, ang Staff ay karaniwang dadalhin sa My work. Ang administrators at managers ay sa Department overview. Kung may binuksang direct document link, puwedeng iyon ang unang destination.',
    'Sa account menu, makikita ang personal options gaya ng password change, theme at sign out. Puwedeng pumili ng light, dark o automatic theme. Takpan ang password habang nire-record at huwag isama ang actual credentials sa final video.'
], ['Capture splash to sign-in; type the approved demo account with password masked.', 'Cut to staff My work, then a manager overview from a separate browser context.', 'Open the account menu and show theme choices and sign-out location.'], 'Sariling account at malinaw na workspace', 'login', 'Use a fresh test profile. Do not publish the stress password or initial-credentials file.', ['E02','E03','E08'])

scene('Pagkilala sa navigation at My work', 'Orientation', 'Staff and administrator comparison', '#/action', [
    'Ang sidebar ang mapa ng application. Nandito ang Department overview, My work kapag applicable, CMED, CMSD, Personnel Schedule, Insights at mga administration pages na pinapayagan sa account.',
    'Sa My work, makikita ang ordinary documents at Special Reports na nangangailangan ng action mula sa naka-sign-in na user. Ang bilang sa queue ay para makatulong sa pag-prioritize, kaya tingnan din ang deadline at current stage.',
    'May in-app action indicator at bell para sa pending work. Ang ibang pagbabago ay lumalabas sa live refresh, karaniwang sa loob ng humigit-kumulang fifteen seconds. Ipakita ang actual queue; huwag ilarawan itong email o text-message notification service.'
], ['Pan through visible sidebar groups in the staff account.', 'Open My work; point to an ordinary document and a Special Report action card.', 'Show the bell and a staged update from another account; allow time for refresh.'], 'Unahin ang records na naghihintay sa iyo', 'workspace', 'Open dialogs and unsaved forms can defer refresh. Keep the demonstration free of unsaved edits.', ['E02','E03','E04','E08'])

scene('Department overview at paghahanap ng records', 'Finding work', 'Admin Staff or manager', '#/dashboard', [
    'Sa Department overview, puwedeng makita ang monitored documents, ongoing work, action required, Overdue Stay at cleared records. Ang mga tile ay filters na puwedeng piliin para mas mapaliit ang listahan.',
    'Mag-search gamit ang tracking number, subject o originating office. Pagkatapos, gamitin ang division, priority at available advanced filters, saka ang sorting at pagination. Puwede ring pumili ng columns at mag-save ng sariling view.',
    'Tandaan na ang Overdue Stay ay kasama ang overdue deadlines at applicable stalled desk records. Hindi lahat ng nandito ay pare-pareho ang dahilan ng delay. Buksan ang record para makita kung deadline ba o desk stay ang kailangang aksiyunan.'
], ['Click total, ongoing and Overdue Stay tiles on the populated registry.', 'Search the hero record; show More filters, sorting, columns and page controls.', 'Save a named view and reopen it; point to the distinct delay labels.'], 'Hanapin at i-filter bago mag-follow up', 'registry', 'Saved views and registry preferences are per account and browser. Avoid claiming that they sync across devices.', ['E02','E03'])

scene('Preview at pagbabasa ng document details', 'Finding work', 'Any signed-in user with applicable actions', '#/dashboard then #/doc/{id}', [
    'Kung gusto munang sumilip nang hindi iniiwan ang listahan, gamitin ang Preview in drawer. Makikita ang key details at available actions, at puwedeng lumipat sa previous o next record sa kasalukuyang queue.',
    'Sa full document page, unahin ang status, responsible desk, deadline, desk age at next action. Nasa record din ang source, document type, division, priority at iba pang registration details.',
    'Sa ibaba, tingnan ang Files and links, review comments at movement history. Ang history ang magpapakita kung ano ang nangyari at sino ang gumawa ng action. Kapag may tanong sa progress, dito tayo bumabalik sa halip na manghula mula sa title lang.'
], ['Enable drawer preview and open the hero record from the registry.', 'Highlight summary fields, then Open full document.', 'Scroll to files, comments and history; return to the current action panel.'], 'Status at current desk muna bago mag-action', 'detail', 'Some details are broadly viewable; an available view does not grant permission to perform every action.', ['E02','E03'])

scene('Pag-log ng bagong document', 'Document lifecycle', 'Marian Grace Paling / Admin Staff', 'New document form', [
    'Magsimula tayo sa bagong ordinary document. Ilagay ang date received, communication type, received from, reference number at malinaw na subject. Piliin ang document type at target division, saka ang Normal o Urgent priority.',
    'Kung may original document sa approved file storage, ilagay ang complete web link. Puwede ring maglagay ng pages at remarks. I-review muna ang details bago i-save; tutulungan ng validation na mahuli ang kulang o invalid na input.',
    'May choice na i-save muna sa Admin desk o i-forward kung handa na. May generated tracking number ang record. Para sa ordinary assignment-based processing, ang simpleng registration pa lang ay hindi pa pagsisimula ng processing clock.'
], ['Open New document as mpaling; enter a synthetic letter with a meaningful subject.', 'Fill current active references and a safe demonstration file URL; show one required-field validation.', 'Save without forwarding; show received status, generated tracking number and unstarted clock.'], 'Maayos na registration ang simula ng tracking', 'form', 'Hero record: DEMO Site inspection coordination request, CMED. Urgent is a label, not a separate automatic deadline rule.', ['E01','E02','E07'])

scene('Forwarding at assignment ng Focal', 'Document lifecycle', 'Admin Staff then Aubrey Camille C Cabrera / Focal', '#/doc/{id}', [
    'Kapag kumpleto na ang intake details, i-forward ang ordinary document sa configured division focal. Magbabago ang current desk at status, at magkakaroon ng bagong movement entry.',
    'Sa Focal account, piliin ang transaction type, i-confirm ang document type at italaga ang active staff na magpoproseso. Sa example natin, si Danezel Christian Cruz ang assignee. Dito nagsisimula ang applicable assignment-based clock.',
    'Ang due date ay galing sa configured rules. May transactions na nangangailangan ng special date kapag walang prescribed document-type deadline. Ang For information only ay para sa eligible focal assignment. Sundin ang available options sa actual form, hindi isang memorized na fixed deadline.'
], ['Forward the hero record as mpaling; show at_focal in history.', 'Switch to acabrera and assign to dcruz using an appropriate active transaction type.', 'Point to processing status, assignee, clock start and computed deadline.'], 'Assignment ang simula ng applicable processing clock', 'workflow', 'Use the current configured threshold. Record exact account switches as separate takes; do not make one shared admin account impersonate the whole chain.', ['E01','E02','E07','E10'])

scene('Pag-unawa sa deadlines at desk limits', 'Document lifecycle', 'Presenter and Focal', '#/doc/{id} and Reference lists', [
    'Hindi iisang deadline ang para sa lahat. Puwedeng prescribed working days, calendar days, o reporting-period basis ang document type. May transaction-based deadline din kapag iyon ang applicable fallback.',
    'Sa working-day calculations, may epekto ang weekends at configured holidays. Iba rin ang due soon, due today at overdue. Kapag walang applicable deadline, ipapakita iyon nang hiwalay sa record na hindi pa nagsisimula ang clock.',
    'Bukod sa document deadline, may Admin at Focal desk limits para makita ang sobrang tagal sa isang desk. Kaya mahalagang basahin ang label at context. Ang Urgent priority ay hindi automatic na nagpapalit sa deadline rule.'
], ['Compare labelled examples: unstarted, no deadline, on time, due soon, due today and overdue.', 'Show a document-type basis and the Holidays reference tab without changing production values.', 'Contrast deadline age with current-desk age using two populated test records.'], 'Deadline at desk stay ay magkaibang sukatan', 'deadline', 'Use visible dates from the recording day. Label examples rather than promising a particular due date for every document.', ['E01','E02','E08'])

scene('Staff processing at Files and links', 'Document lifecycle', 'Danezel Christian G Cruz / Staff', '#/action then #/doc/{id}', [
    'Sa Staff account, lalabas sa My work ang assigned document. Buksan ito at i-check ang instructions, deadline at source bago gumawa ng output. Ang DTS ang tracking record ng trabaho at review history.',
    'Sa Files and links, puwedeng ilagay ang original, draft at revised file links ayon sa authority ng user. Ang actual files ay nasa linked storage. Hindi ito direct file upload o isang built-in document editor.',
    'Kapag handa na ang draft, i-submit para sa review at piliin ang tamang eligible reviewer. Sa example, ang supervisor ni Cruz ay si Maria Urduja Jean Tabilas. Maglagay ng maikling context para mas malinaw kung ano ang kailangang tingnan ng reviewer.'
], ['Sign in as dcruz and open the hero record from My work.', 'Save a draft link; point out original, draft and revised link sections.', 'Submit to mtabilas and show the supervisor-review status.'], 'Ihanda ang output at isumite sa tamang reviewer', 'detail', 'A link change and revision counter are not historical file-version storage. Opening external previews depends on the linked service and browser rules.', ['E01','E02','E03','E10'])

scene('Review comments at compliance cycle', 'Document lifecycle', 'Supervisor then assigned Staff', '#/doc/{id}', [
    'Sa Supervisor account, may dalawang karaniwang resulta: puwedeng i-approve ang draft o ibalik sa staff para sa compliance. Kapag ibabalik, ilagay ang malinaw at actionable na comments.',
    'Makikita ng assigned Staff ang comments sa record. Gawin ang correction, i-update ang revised file link kung kailangan, at ilarawan kung paano na-address ang request bago mag-resubmit.',
    'Naiiwan sa record ang compliance cycle at history. Ang resubmission behavior ay nakadepende sa configured policy, halimbawa kung babalik sa returning reviewer o magsisimula muli sa supervisor review. Sa demo, ipakita ang actual destination pagkatapos mag-submit.'
], ['As mtabilas, return the hero document with one specific supporting-checklist comment.', 'As dcruz, add a revised link and a concrete compliance response.', 'Resubmit; show resolved comments, cycle count and the configured returning stage.'], 'Malinaw na comments at dokumentadong compliance', 'review', 'Resubmission resolves outstanding review comments together; do not imply individual per-comment resolution buttons.', ['E01','E02','E03'])

scene('Division review at clearance', 'Document lifecycle', 'Supervisor then Division Manager then Department Manager', '#/doc/{id}', [
    'Kapag maayos na ang output, itutuloy ng Supervisor ang document sa Division Manager. Mula roon, mapupunta ito sa Department review para sa final assessment at clearance.',
    'Puwede pa ring may return for compliance sa applicable review stage. Kung cleared na, i-record ang clearance gamit ang tamang authorized account. Sa ordinary example natin, si Myles Martinez ang CMED Division Manager at si Oscar Hanova ang Department Manager.',
    'Mahalagang distinction ito: ang Cleared for Out ay hindi pa ang actual release. Humihinto ang applicable processing clock sa clearance, pero may hiwalay pang log-out step para ma-record kung kailan at kanino inilabas ang document.'
], ['Approve as mtabilas, then approve as mmartinez; show each status transition.', 'Clear as ohanova and hold the Cleared for Out state.', 'Compare clearance timestamp with the still-empty release fields.'], 'Cleared for Out ay hiwalay sa release', 'workflow', 'The live engine includes authorized early-clear/override cases. Present the standard sequence without claiming every review step is universally mandatory.', ['E01','E02','E10'])

scene('Reassignment at return to sender', 'Document lifecycle', 'Focal or eligible manager and Admin Staff', '#/doc/{alternate-id}', [
    'May mga pagkakataong kailangang ilipat ang processing sa ibang eligible staff. Sa allowed stage at account, gamitin ang reassignment at maglagay ng context. Mananatili ang movement history ng naging responsibility.',
    'Iba naman ang return for compliance sa instruction na ibalik ang document sa sender. Sa return-to-sender path, maglalagay ang authorized reviewer ng reason at mapupunta ang document sa For return na naghihintay ng Admin log out.',
    'Gumamit tayo ng hiwalay na sample para hindi mawala ang main example. Tingnan ang status, reason at next responsible desk bago magpatuloy. Walang generic cancel o reopen button na dapat ipakita bilang kasalukuyang feature.'
], ['Use a separate processing record to reassign between two current eligible staff.', 'Use another allowed record to enter an authorized return-to-sender instruction with a reason.', 'Show return_out and its Admin release step beside the compliance example.'], 'Magkaiba ang compliance at return to sender', 'branch', 'Show manager/override labels if used. Do not claim that reassignment always requires a reason field or resets the deadline.', ['E01','E02'])

scene('Actual release at routing slip', 'Document lifecycle', 'Admin Staff', '#/doc/{id} and registry batch controls', [
    'Bumalik tayo sa cleared document. Sa Admin Staff account, ilagay kung kanino ito ire-release at ang applicable remarks. Kapag na-log out, may release timestamp, releasing user at destination na ang record.',
    'Mananatiling searchable ang released document. Makikita pa rin ang registration details, comments at movement history. Puwede ring mag-print ng routing slip para sa record ng naging proseso.',
    'May selected-record tools para sa print at CSV, at may eligible batch forwarding at log out. Basahin ang confirmation dahil may records na puwedeng ma-skip. Ang batch log out ay gumagamit ng original sender bilang recipient at current time, kaya individual release ang gamitin kapag iba-iba ang actual destination.'
], ['Log out the hero record individually as mpaling with a specific demonstration destination.', 'Open its movement history and print routing slip preview.', 'Show batch controls on separate eligible test records and read the confirmation without deleting records.'], 'Release na may petsa recipient at history', 'release', 'Bulk deletion is administrator-controlled and optional to explain verbally; never demonstrate it against real records.', ['E01','E02','E03'])

scene('Consolidated CMR and PPR', 'Reports', 'Admin Staff and designated regional staff', '#/cmed/regular', [
    'May espesyal na registration flow ang Consolidated CMR and PPR. Pipiliin ang region o office at reporting period, dahil ang responsibility ay galing sa configured report designation.',
    'Kapag na-log ang reporting-period document, dumidiretso ito sa designated active staff at nilalampasan ang ordinary focal-assignment step. Ang division para sa bagong record ay galing sa configured assignee kapag identifiable ang division niya.',
    'Ang deadline ay kino-compute mula sa document-type rule para sa reporting period. Ang starting rule para sa consolidated report ay sixth working day ng kasunod na buwan, pero puwedeng baguhin ng administrator ang configuration. Sa Regular Reports, makikita ang regions at status ng kanilang submissions.'
], ['Open CMED Regular Reports and the consolidated-report tab.', 'Create a sample for a configured region and reporting month; show designated staff and automatic routing.', 'Highlight the computed deadline and a region drilldown.'], 'Reporting period at designation ang gabay', 'reports', 'Confirm the current prescribed threshold before filming; do not narrate the default six days as an immutable rule.', ['E01','E02','E08'])

scene('CMED at CMSD reporting views', 'Reports', 'Authorized division user or department account', '#/cmed and #/cmsd/performance', [
    'May magkahiwalay na destination ang CMED at CMSD. Ang default ay List of Documents. Sa CMED, may Regular Reports din; ang available performance tab ay Turnaround Time and On-Time Rate para sa account na may report permission.',
    'Ang reporting ownership ay sumusunod sa responsible personnel. Kaya mahalaga ang tamang assignment at division ng user. Ang shared report na walang isang identifiable division ay hindi isinasama sa individual division metrics.',
    'Ang division access ay chine-check din ng server. Pero hindi nito ibig sabihin na confidential na ang lahat ng underlying documents sa Department overview. Ihiwalay natin ang access sa division destination, permission na mag-action, at policy sa pagtingin ng basic records.'
], ['Open CMED List of Documents, then CMED Regular Reports.', 'Open CMSD and show its document list and performance tab; do not add a CMSD Regular Reports tab.', 'Show a permitted account and a denied direct division route in separate takes.'], 'Division reports ayon sa responsible personnel', 'division', 'This is reporting scope, not blanket record confidentiality. Keep this qualification in the spoken script.', ['E01','E02','E07','E08'])

scene('Pag-configure ng Special Reports', 'Reports', 'Administrator with configuration permission', 'Reference lists > Special Reports', [
    'Para sa recurring obligations, may Special Reports schedules. Sa Reference lists, puwedeng itakda ang report name, frequency, reporting months, generation day, deadline threshold at responsible people o division focals.',
    'Available ang monthly, quarterly, specific months at annual schedules. Ang generation ay para sa reporting period na natapos, at ang configured generation day ay nasa kasunod na buwan. Ipakita natin ang isang malinaw na monthly example.',
    'Dapat may eligible responsible person bago i-activate ang schedule. Ang initial starter schedules ay inactive at unassigned. Hindi sapat na may report name lang; kailangang kumpleto ang configuration at responsibility para makabuo ng tamang assignment.'
], ['Open Reference lists, Special Reports, Schedules.', 'Show monthly, quarterly, specific-month and annual choices, generation day and working-day threshold.', 'Assign current staff on a disposable schedule and show the active-state validation.'], 'Recurring reports na may malinaw na schedule', 'config', 'Do not activate or change real recurring schedules while recording. Search supports enrolled names, roles and divisions.', ['E01','E04','E07','E08'])

scene('Generated Special Reports at review workflow', 'Reports', 'Assigned staff and reviewers', 'CMED Regular Reports > Special Report / My work', [
    'Kapag due na ang schedule, ang server ang gumagawa ng report at assignment. Chine-check ito sa startup at periodically; may catch-up para sa missed generation dates at may protection laban sa duplicate obligation para sa parehong schedule at period.',
    'Sa assigned staff account, lalabas ang report sa My work. Dadaan ito sa submission, review, possible compliance, clearance at log out. Nananatili ang assignment history kahit may allowed reassignment bago pumasok sa review.',
    'May Special Report tab sa regular reporting area at kasama ang generated records sa relevant monitoring. Ang generation ay hindi automatic submission ng report content. Ang staff pa rin ang kailangang gumawa ng output at kumpletuhin ang review process.'
], ['Show an existing generated report with period, deadline and responsible staff.', 'Open it from My work; demonstrate one submission and compliance example.', 'Show generated-report assignment history and a released report in reporting.'], 'Auto generation ay simula ng obligation', 'special', 'Do not claim automatic Drive folders, email delivery or Personnel Schedule events. The generator uses configured working-day deadlines.', ['E01','E04','E07','E08'])

scene('Personnel Schedule para sa availability', 'Scheduling', 'Viewer then user with schedule management permission', '#/schedule', [
    'Bukod sa documents, may Personnel Schedule para sa inspections, leave at meetings. Ang personnel ay mula rin sa enrolled user accounts, kaya hindi na kailangan ng hiwalay na pangalanan ulit ang parehong staff.',
    'May Month, Week, Day at Agenda views. Puwedeng mag-filter at tingnan ang date range at mga taong kasali. Ang pag-add, edit at delete ay para sa account na may schedule-management permission.',
    'Kapag may overlapping activity para sa parehong tao, may conflict warning. Puwedeng i-review ng authorized user at i-confirm ang Save anyway. Ang leave ay whole-day availability; hindi nito automatic na pinapalitan ang OIC o document assignee.'
], ['Show all four calendar views and a personnel filter.', 'Create one test inspection, leave entry and meeting; show shared participants.', 'Trigger an overlap warning, explain confirmation, then show the saved schedule details.'], 'I-check ang availability at conflicts', 'calendar', 'Inspection project is free text with suggestions from prior entries, not a separate project-management module. No automatic leave-to-OIC linkage.', ['E01','E05','E07','E08'])

scene('Analytics at tamang pagbasa ng metrics', 'Monitoring', 'User with report permission', '#/analytics', [
    'Sa Insights, buksan ang Analytics at piliin ang reporting period at division. Makikita ang document volume, open at finished work, on-time rate, average turnaround at supporting breakdowns.',
    'May kahulugan ang bawat date basis. Ang receipt cohort ay batay sa date received. Ang released-in-period ay batay sa release date, kahit mas maaga natanggap ang document. Ang current backlog ay open records ngayon mula sa lahat ng receipt dates.',
    'Ang turnaround na ipinapakita ay working days mula assignment hanggang clearance, hindi simpleng receipt-to-dispatch time. Basahin din ang cohort at threshold bago mag-compare ng staff o division. Hindi natin tatawaging productivity score ang isang number na walang context.'
], ['Open Analytics and set a visible month range and division.', 'Highlight the receipt, release and current-backlog KPI notes.', 'Point to turnaround and on-time labels, then staff/document/transaction breakdown tables.'], 'Basahin ang date basis bago mag-compare', 'analytics', 'Finished metrics can include records with a stopped clock at clearance. Retain the distinction from final release.', ['E02','E03','E08'])

scene('Charts at drilldown sa actual records', 'Monitoring', 'User with report permission', '#/graphs', [
    'Sa Charts, mas madaling makita ang volume by month, received at released records, finished on time o late, status mix at deadline health. May view rin ng workload at time sa current desk.',
    'Kapag may malaking overdue o desk-age group, puwedeng piliin ang applicable chart bar o desk para buksan ang matching registry records. Nananatili ang relevant reporting filters para may malinaw na koneksiyon ang chart at underlying list.',
    'Gamitin natin ang drilldown para mag-verify. Hindi sapat ang mataas na bar lang; tingnan kung anong documents ang nasa likod nito, sino ang current assignee, at anong action ang kailangan. Mas nagiging specific ang follow-up kapag record-level na ang usapan.'
], ['Show monthly volume, status mix, deadline health and staff workload.', 'Click an age band or desk and inspect the filtered registry.', 'Open one matching document, then return to the selected chart context.'], 'Mula summary papunta sa matching documents', 'charts', 'Some charts show the selected receipt cohort while release totals use release dates. Keep visible period labels in every capture.', ['E02','E03'])

scene('Print CSV at selected outputs', 'Monitoring', 'User with print and export permission', 'Registry / Analytics / Charts / Audit', [
    'Kung kailangan ng offline copy o supporting list para sa meeting, may print at CSV tools sa relevant pages. Sa registry, puwedeng current filtered records o selected records ang output, depende sa kasalukuyang selection.',
    'May routing slip para sa document history, registry printout, analytics summary, division performance output at chart printing. I-check ang heading, period, division at record count bago mag-print o mag-share.',
    'Ang exported CSV ay para sa spreadsheet analysis; hindi ito CSV import feature. Kapag may selection, siguraduhing iyon talaga ang gustong i-export. Ipakita natin ang preview at file contents para makita na tugma ang output sa scope na pinili.'
], ['Filter the registry and export a CSV; verify headers, count and scope.', 'Show a routing slip, analytics print preview and a division-performance export.', 'Show chart print and audit output controls only under authorized accounts.'], 'I-verify ang scope bago mag-share', 'exports', 'A printable chart page may depend on browser print settings. Do not portray exports as automatic scheduled distribution.', ['E02','E03','E07'])

scene('Users roles at division focals', 'Administration', 'System Administrator', '#/users > #/roles > #/divisions', [
    'Sa Users, makikita ang enrolled accounts, role, division, active state at last sign-in information. Ang administrator ang may control sa account creation, maintenance at password reset ayon sa available permissions.',
    'Sa Roles and permissions, nakikita kung anong actions ang pinapayagan sa bawat role. May desk conditions pa rin: halimbawa, assignment para sa tamang focal at submission para sa assigned staff. Ang System Administrator ay may broad administrative authority.',
    'Sa Divisions and focals, itinatakda kung sino ang receiving focal ng bawat division. Hindi dapat basta i-deactivate ang configured focal nang walang kapalit. Ang changes sa role at assignment ay dapat sinasadya, dahil nakaaapekto ang mga ito sa queues, routing at reporting ownership.'
], ['Open the current 18-account roster; highlight role/division/active columns.', 'Show the permission matrix without changing real permissions.', 'Open Divisions and focals and show the current CMED/CMSD focal mappings.'], 'Configuration na nakaaapekto sa actual work', 'admin', 'Explain account deactivation and reset verbally or in an isolated copy. General viewing policy is distinct from action permissions.', ['E01','E02','E07','E10'])

scene('Delegation presence at OIC', 'Administration', 'Manager and authorized OIC administrator', '#/delegation', [
    'Kapag wala ang usual approving manager, may Delegation and OIC page para makita ang configured availability at final-review responsibility. Nandito ang manager presence at nominated OIC.',
    'Ang resolver ay tumitingin sa present Department Manager, applicable Division Managers at enabled eligible OIC ayon sa current rules. May authorized clearance paths din sa operational engine, kaya sundin ang actual account permissions at action panel.',
    'Manually maintained ang manager presence at OIC setup. Hindi ito automatic na ine-enable dahil lang may leave entry sa Personnel Schedule, at walang automatic delegation-expiry workflow na dapat i-assume. Sa demo, ibalik ang test configuration pagkatapos ipakita ang fallback.'
], ['Show the current final-review responsibility banner.', 'On a disposable copy, demonstrate present/away states and OIC nomination/enable controls.', 'Restore original test presence/OIC settings and point back to the applicable document action.'], 'Malinaw na authority kapag may absent', 'delegation', 'Avoid claiming that all clearance is universally blocked whenever a manager is away; existing authorized exceptions must remain explicit.', ['E01','E02','E07'])

scene('Reference lists at business rules', 'Administration', 'User with configuration permission', '#/refs', [
    'Sa Reference lists nakalagay ang options at rules na paulit-ulit ginagamit sa system. Kasama ang Transactions, Document types, Communication types, Leave types, Holidays, Report designations at Special Reports.',
    'Sa document types, puwedeng i-configure ang prescribed threshold, unit at deadline basis. Sa report designations, itinatakda ang responsible staff ng bawat region o office. Sa holidays, nakasalalay ang working-day calculations.',
    'Ang active o inactive na state ay mahalaga para sa bagong entries at historical records. May dependency checks sa ilang ginagamit nang references. Bago magbago ng business rule, i-review ang epekto at sundin ang authorized configuration process.'
], ['Walk through all seven Reference list tabs with their actual labels.', 'Open a document-type dialog; highlight threshold, basis, unit and active state.', 'Show Holidays and Report designations, then a protected used-reference example on the test copy.'], 'Dito nanggagaling ang maraming operational rules', 'config', 'Do not delete historical references for cosmetic cleanup. Changes generally govern subsequent computation/generation rather than rewriting all historical workflow records.', ['E01','E02','E07','E08'])

scene('Settings at everyday usability', 'Administration', 'Administrator and ordinary staff comparison', '#/settings and account menu', [
    'Sa System Admin Settings, may office name, tracking prefix, inactivity timeout, due-soon threshold, desk limits, resubmission policy at cursor particle trail. Ang mga ito ay system behavior settings na kailangang i-review bago i-save.',
    'Sa ordinary use, may keyboard shortcuts, responsive tables, clear saving feedback at protection kapag may unsaved changes. May focus handling sa dialogs para mas maayos ang keyboard navigation.',
    'Puwedeng itoggle ang decorative cursor effect, at may respect ito sa reduced-motion preference. Ang theme at saved registry preferences ay browser-level conveniences. Ang system settings naman ay server-saved at lumalabas sa ibang users sa normal refresh cycle.'
], ['Show each settings field without changing the live configuration.', 'Open keyboard shortcuts; show an unsaved-change prompt on a disposable form.', 'Show light/dark theme and reduced-motion-friendly cursor settings briefly.'], 'Mas malinaw na feedback sa araw-araw na use', 'settings', 'Keep cursor effects subtle in the recording. Do not claim a formal accessibility certification.', ['E02','E03','E08'])

scene('Audit log para sa traceability', 'Administration', 'User with audit permission', '#/audit', [
    'Bukod sa movement history ng isang document, may Audit log para sa system activity. Kasama rito ang sign-ins, document actions at administrative changes na nire-record ng server.',
    'Puwedeng mag-search ng relevant entries at gumamit ng available print o export controls. Ang screen ay nagpapakita ng latest matching entries sa supported limit; hindi ito unlimited full-history search sa bawat lumang event.',
    'Para sa isang concern, magsimula sa document history, saka i-correlate sa audit entry kung kailangan. May user, time, action at detail para mas madaling ma-review ang nangyari. Hindi natin ilalarawan itong tamper-proof compliance certification o legal electronic-signature system.'
], ['Search the audit log using the hero tracking number or a distinctive action detail.', 'Point to timestamp, user, action and detail columns.', 'Compare one audit action with the hero document movement entry; show export permission.'], 'Document history at system activity may sariling view', 'audit', 'Current audit query searches a recent server-side window and displays up to 200 matches. Use current visible labels rather than claiming unlimited audit retention.', ['E02','E07'])

scene('Backup restore at recovery', 'Administration', 'Administrator with data permission', '#/settings > Settings and data', [
    'May administrator tools para sa full JSON backup at restore. Naka-include ang core configuration at supported records, kaya iba ito sa isang filtered CSV report.',
    'Sa restore, vini-validate ang supplied data at may recovery copy bago palitan ang stored state. Sa server, may daily SQLite backups at retention para sa recent backup files. Kailangan pa rin ng approved off-machine backup routine.',
    'Sa showcase, ipapakita natin ang controls at prepared results sa isolated test copy. Hindi tayo magre-restore o mag-clear ng real records habang nagpe-present. Pagkatapos ng authorized recovery, i-verify ang users, documents, schedules, reports at ability na mag-sign in.'
], ['Show Backup and Restore controls, keeping reset/clear actions visually separate.', 'Use a labelled test-only insert showing valid restore and rejected invalid restore results.', 'Show recovered counts and successful sign-in from the stress-test evidence.'], 'Backup ay kailangan ding ma-verify', 'backup', 'Backups contain sensitive application/account data. Use approved storage; do not expose backup contents or password hashes in footage.', ['E07','E08','E09'])

scene('Workflow Designer at simulation', 'Administration', 'System Administrator', '#/workflow', [
    'May visual Workflow Designer para gumawa at mag-review ng workflow definitions. Puwedeng maglagay ng Start, Action, Decision at End, ayusin ang connectors, labels, properties at layout, at mag-save ng draft.',
    'May validation, versioning, publish at simulation. Sa simulation, puwedeng gumamit ng sample document at makita ang branch path at candidate responsibility nang hindi binabago ang actual document workflow.',
    'Sa current version, ang designer ay para sa drafting, publishing at simulation. Ang live document actions ay gumagamit pa rin ng existing operational engine; hindi pa enabled ang generic designer execution. Kaya huwag nating sabihing automatic nang magro-route ang documents dahil lang na-publish ang diagram.'
], ['Open a prepared draft with Start, Action, Decision and End; show properties and connector labels.', 'Show Arrange, fit, zoom, minimap, undo/redo, save state and a version selector.', 'Run validation and read-only simulation; place a visible current-scope label beside the result.'], 'Draft validate publish at simulate', 'designer', 'Label the scene Designer and simulation. Do not animate a notification node as if it actually sends email or changes live assignments.', ['E06','E07','E08'])

scene('Security deployment at practical boundaries', 'Operations', 'Presenter', 'Sign-in / settings / architecture visual', [
    'Sa operational side, server-checked ang sign-in at action permissions. May hashed password storage, protected session cookie, failed-login throttling at configurable inactivity timeout. Ang account deactivation at password reset ay may session effects.',
    'Para sa real deployment, kailangan ang HTTPS at maayos na server access at backup setup. Ang staff ay bumubukas ng browser sa approved DTS address; ang shared database ay nasa server.',
    'May malinaw ding current boundaries: external file links ang ginagamit, walang direct binary upload, walang built-in email reminder service, at hindi parallel workflow execution ang kasalukuyang operational flow. Ang mga ito ay planning considerations, hindi features na dapat idagdag sa demonstration graphics.'
], ['Use a simple labelled browser-to-server diagram, not an invented cloud integration dashboard.', 'Show security controls conceptually without exposing keys, cookies or stored hashes.', 'Present three current boundaries as small factual labels beside real screen captures.'], 'Server checked actions at controlled deployment', 'architecture', 'Avoid absolute claims such as impossible to hack, fully compliant or encrypted file storage. Session and permission controls do not establish blanket division confidentiality.', ['E07','E08'])

scene('Performance proof gamit ang stress test', 'Operations', 'Presenter and stress-test operator', 'Port 3500 / saved report.html', [
    'May hiwalay tayong stress-test launcher para makita ang behavior ng DTS sa mas maraming records. Sa verified run noong October sixteen, twenty twenty-six, may six thousand documents, twelve hundred schedules at two hundred forty-one Special Reports pagkatapos ng scenario checks.',
    'Kasama ang eighteen enrolled accounts, two thousand eight hundred eighty account-stage-action probes at one hundred fifty thousand four hundred eighty reference combinations. Pumasa rin ang twenty-four maintained regression suites.',
    'Sa thirty concurrent full-state requests, ang measured p95 latency ay about two point nine seconds, with zero HTTP errors sa load measurements. Resulta ito sa tested machine at workload, hindi guarantee ng unlimited capacity. Ipakita ang dated report at actual measurements para malinaw ang context.'
], ['Open the saved PASS report; show the dated dataset and account count.', 'Show the action-matrix and reference-combination totals plus maintained-suite results.', 'Highlight the 30-request p95 row, zero errors, resource figures and original-data comparison.'], '6000 documents at measured results', 'proof', 'p95 is not average or per-user screen time. Distinguish 30 concurrent requests from six concurrent enrolled-role browser sessions. Earlier development latency reached 3.37 seconds.', ['E09'])

scene('Recap at guided staff practice', 'Closing', 'Presenter', '#/dashboard and #/action', [
    'Balikan natin ang ordinary flow: log, forward, assign, process, review, comply kung kailangan, clear at release. Sa bawat step, may current responsibility at history na puwedeng balikan.',
    'Para sa daily work, magsimula sa My work, i-check ang deadline at instructions, panatilihing tama ang file links, at magbigay ng malinaw na comments o compliance response. Para sa monitoring, gamitin ang filters at drilldowns bago magbigay ng conclusion.',
    'Ang susunod nating activity ay isang guided practice sa approved test environment. Bawat role ay gagawa ng sariling step sa isang sample document. Pagkatapos, i-check natin kung tugma ang final status, recipient at movement history. Mula rito, puwede nang pag-usapan ang rollout questions at actual office procedures.'
], ['Return to the same hero record now released; show a concise chronological path.', 'Show the role-based practice checklist and the test-environment label.', 'Hold a simple closing frame with the proposed next activity; leave space for questions.'], 'Mag-practice gamit ang tamang account', 'closing', 'Leave the CTA actionable and internal. Do not invent deployment dates, sponsor endorsements or a public support contact.', ['E01','E02','E03'])

CAST = [
 ('Admin Staff','Marian Grace Paling','mpaling','Log, forward and record release'),
 ('CMED Focal','Aubrey Camille C. Cabrera','acabrera','Assign and monitor division work'),
 ('Staff','Danezel Christian G. Cruz','dcruz','Process, link outputs and submit'),
 ('Supervisor','Maria Urduja Jean V. Tabilas','mtabilas','Review and request compliance'),
 ('CMED Division Manager','Myles Rovi P. Martinez','mmartinez','Division review'),
 ('Department Manager','Oscar B. Hanova Jr.','ohanova','Final review and clearance'),
 ('System Administrator','System Administrator','admin','Configuration and administration')]

SHORT = [
 ('00:00-00:20','S01 S06','Kapag may nagtanong kung nasaan na ang isang document, puwedeng buksan ang DTS para makita ang status, current desk, deadline at movement history. Isang record ang sinusundan mula pagtanggap hanggang release.'),
 ('00:20-00:40','S07 S08','Sa Admin Staff nagsisimula ang registration. Pagkatapos, ifo-forward ito sa configured Focal, na mag-aassign ng transaction, document type at responsible staff. Ang applicable processing clock ay nagsisimula sa assignment.'),
 ('00:40-01:00','S10 S11','Sa My work, makikita ng staff ang assigned records. Dito bubuksan ang instructions, ilalagay ang external draft o revised file links, at isusumite ang output sa reviewer. Kapag may comments, may documented compliance cycle.'),
 ('01:00-01:20','S12 S14','Dadaan ang standard example sa supervisor, division at department review. Ang clearance ay hiwalay sa actual release. Sa log out, itinatala ang recipient, releasing user at oras, habang nananatiling searchable ang history.'),
 ('01:20-01:40','S15 S17 S18','Para sa reporting, may designated regional processing ng Consolidated CMR and PPR at configured recurring Special Reports. Ang automatic generation ay gumagawa ng obligation; staff pa rin ang kailangang mag-submit at kumumpleto ng review.'),
 ('01:40-02:00','S19 S20 S21','Makakatulong ang Personnel Schedule sa availability at conflict checks. Sa Analytics at Charts, puwedeng tingnan ang workload, deadlines at turnaround, saka mag-drill down sa matching records para ma-verify ang summary.'),
 ('02:00-02:20','S23 S25 S27 S28','Sinusuportahan ito ng account permissions, division focals, reference lists, audit log at backup tools. Ang key actions ay chine-check ng server. Sa configuration changes, kailangang malinaw ang authority at epekto sa existing work.'),
 ('02:20-02:40','S29 S31','May workflow drafting at read-only simulation; hindi pa ito generic live execution. Sa verified six-thousand-document stress run, walang HTTP request errors at about two point nine seconds ang p95 full-state latency sa thirty concurrent requests sa tested machine.'),
 ('02:40-03:00','S32','Para sa staff, ang practical routine ay simple: gamitin ang sariling account, buksan ang My work, basahin ang deadline at instructions, at i-record nang tama ang bawat action. Simulan natin ang guided practice sa approved test environment.')]

EVIDENCE = {
 'E01':('public/engine.js',['const STAGES=','function can(','function computeDeadline','function act(','function srDeadline']),
 'E02':('public/client.js',['function navItems','VIEWS.dashboard','function listDocs','function actionPanel','VIEWS.analytics','VIEWS.graphs','VIEWS.roles','VIEWS.settings']),
 'E03':('public/ux.js',['VIEWS.dashboard=','VIEWS.action=','ACTIONS.uxFullDocument','const sidebarPages']),
 'E04':('public/special.js',['function spWorkflowDoc','function spConfigPage']),
 'E05':('public/schedule.js',['VIEWS.schedule','function schedule']),
 'E06':('public/workflow.js',['VIEWS.workflow','function wfAction','function wfEditor']),
 'E07':('server.js',['const ACT_TYPES','function backupProblem','/api/admin/restore','/api/special-reports/generate','/api/state','const CSP']),
 'E08':('README.md',['## Deadlines','## Special Reports','## Personnel Schedule','## Security notes','## Division reporting']),
 'E09':('outputs/STRESS-TEST-VALIDATION-2026-10-16.md',['Final result','2,880','2,886']),
 'E10':('data/dts.sqlite',[])}

def stamp(seconds):
    return f'{seconds//60:02}:{seconds%60:02}'

def prepare():
    for i,s in enumerate(SCENES):
        s['start']=i*60; s['end']=(i+1)*60; s['timecode']=f'{stamp(s["start"])}-{stamp(s["end"])}'
        s['voiceover_words']=len(re.findall(r"\b[\w'-]+\b",' '.join(s['voiceover'])))
        s['estimated_spoken_seconds']=round(s['voiceover_words']/130*60)
        s['demo_hold_seconds']=max(0,60-s['estimated_spoken_seconds'])
        s['shots']=[dict(id=f'{s["id"]}-{j+1}',start=s['start']+j*20,end=s['start']+(j+1)*20,action=a,voiceover=s['voiceover'][j],transition='Straight cut or short dissolve after the result is readable') for j,a in enumerate(s['actions'])]
        s['capture_status']='Capture planned; reference stills are not final footage'
        s['reference_image']='assets/capture-'+s['id']+'.png'
        s['generation_prompt']=f"Create a 16:9 editorial scene using the supplied authentic DTS screen recording for {s['route']}; use {s['reference_image']} as the framing reference. Focus: {s['title']}. Overlay exactly: {s['overlay']}. Preserve interface text and actual actions. Use a restrained crop or highlight that follows the spoken cue. Narration is the three supplied Taglish paragraphs in order. Reserve the lower 17 percent for captions. Do not synthesize buttons, records, integrations, notifications or successful actions. Required qualification: {s['presenter_note']}"
    for name in ['logo-black.png','logo-white.png']:
        shutil.copyfile(ROOT/'public'/name,ASSETS/name)
    latest=json.loads((ROOT/'.stress-tests/3500/latest.json').read_text())
    run=Path(latest['directory'])
    for name in ['stress-dashboard.png','stress-graphs.png','stress-mobile.png']:
        if (run/name).exists(): shutil.copyfile(run/name,ASSETS/name)
    evidence=[]
    for key,(file,terms) in EVIDENCE.items():
        item=dict(id=key,file=file,locations=[])
        if file.endswith('.sqlite'): item['scope']='Read-only roster fields only; no passwords or session values exported.'
        else:
            lines=(ROOT/file).read_text(encoding='utf-8-sig').splitlines()
            for term in terms:
                found=next((i+1 for i,line in enumerate(lines) if term in line),None)
                if found:item['locations'].append(dict(anchor=term,line=found))
            item['sha256']=hashlib.sha256((ROOT/file).read_bytes()).hexdigest()
        evidence.append(item)
    plan=dict(title='DTS Staff Showcase Script and Storyboard',language='Taglish',audience='Enrolled staff, supervisors, focals and managers',date='2026-10-16',format='1920x1080',fps=30,master_duration_seconds=1920,short_duration_seconds=180,narration_wpm=130,status='Production planning package; video not rendered',hyperframes_usage='Unknown: CLI not present in local cache',scenes=SCENES,cast=CAST,short_script=SHORT,evidence=evidence)
    (OUT/'showcase-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
    return plan

def markdown(plan):
    words=sum(s['voiceover_words'] for s in SCENES)
    intro=f'''# DTS Staff Showcase Script

Taglish staff demonstration | 32 minutes with screen-action holds | 32 matching scenes

This showcase teaches staff how to register, process, review, release and monitor work in the current DTS. Follow one demonstration document through the ordinary lifecycle, then open the reporting, scheduling and administrative tools that support it. Every scene has a matching storyboard frame and three capture beats.

The master contains {words:,} spoken words, about {words/130:.1f} minutes at 130 words per minute; the rest of the 32-minute schedule is allocated to clicks, role switches and reading results. Timecodes are planning estimates. A live session can allow 5-10 additional minutes for questions. Preserve the scene IDs when retiming after recording.

## How to use the package

- Read the narration below; bracketed screen directions are production notes, not spoken dialogue.
- Open `storyboard.html` beside this file for the matching visual and capture beats.
- Use `shot-list.csv` or `showcase-plan.json` for production handoff. Scene IDs and timecodes match across files.
- Use `SHORT-SCRIPT.md` for the three-minute overview. It is an alternate cut, not an additional chapter.
- All 32 storyboard keyframes contain authentic reference stills from a disposable stress-test copy. Record the matching actions for final footage. Separate reference samples illustrate stages; follow one tracking number when recording the complete lifecycle.

## Recording preparation

1. Use the approved disposable demonstration or port-3500 stress environment. Wait for its automated RESULT before manual editing. Preserve the original application database.
2. Prepare three distinct document examples: the ordinary hero document, a reassignment example and a return-to-sender example. Prepare regional and generated Special Reports separately.
3. Use separate browser profiles or contexts for each role. Use the enrolled account responsible for that take; hide passwords and all credential files.
4. Confirm active references, designated regional staff, deadlines, holidays, current manager presence and OIC before filming. Record the actual configured values.
5. Match the screen's selected period, division and record count to every spoken claim. Use the dated stress report for measured performance.
6. Record at 1920x1080 with a readable browser scale, then crop toward the action. Keep lower captions clear of buttons and status fields.

## Demonstration cast

| Role | Enrolled person | Username | Demonstration responsibility |
| --- | --- | --- | --- |
'''
    for role,name,username,task in CAST:intro+=f'| {role} | {name} | {username} | {task} |\n'
    intro+='\n## Chapter map\n\n'
    for chap in dict.fromkeys(s['chapter'] for s in SCENES):
        rows=[s for s in SCENES if s['chapter']==chap]
        intro+=f'- {stamp(rows[0]["start"])}-{stamp(rows[-1]["end"])}: {chap}\n'
    body=''
    for s in SCENES:
        body+=f'\n## {s["id"]} {s["title"]}\n\n**{s["timecode"]} | {s["role"]} | {s["route"]}**\n\n### Spoken narration\n\n'+'\n\n'.join(s['voiceover'])+'\n\n### Matching screen beats\n\n'
        for shot in s['shots']:body+=f'- **{shot["id"]} {stamp(shot["start"])}-{stamp(shot["end"])}:** {shot["action"]}\n'
        body+=f'\n**On-screen line:** {s["overlay"]}\n\n**Presenter cue:** {s["presenter_note"]}\n\n**Evidence:** {", ".join(s["evidence"])}.\n'
    (OUT/'SCRIPT.md').write_text(intro+body,encoding='utf-8')
    short='# DTS Three Minute Overview\n\nTaglish alternate cut. Use the linked master scenes; maintain the qualifications stated below. Read at approximately 130-140 words per minute and retime after the actual voice recording.\n'
    for tc,ids,vo in SHORT:short+=f'\n## {tc} {ids}\n\n{vo}\n'
    short+='\nThe overview does not replace the full staff demonstration or role-specific practice.\n'
    (OUT/'SHORT-SCRIPT.md').write_text(short,encoding='utf-8')
    board='''---
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
'''
    for i,s in enumerate(SCENES,1):
        board+=f'\n## Frame {i} - {s["title"]}\n\n- status: outline\n- src: boards/scene-{i:02}.html\n- duration: 60s\n- transition_in: cut\n- scene: {s["overlay"]}\n- voiceover: {" ".join(s["voiceover"])}\n- timecode: {s["timecode"]}\n- route: {s["route"]}\n- actor: {s["role"]}\n\n'
        board+='\n'.join(f'{j+1}. {a}' for j,a in enumerate(s['actions']))+f'\n\nProduction constraint: {s["presenter_note"]}\n'
    (OUT/'STORYBOARD.md').write_text(board,encoding='utf-8')
    with (OUT/'shot-list.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.writer(f);writer.writerow(['Scene','Shot','Start','End','Chapter','Title','Actor','Route','Voiceover','Capture action','On screen copy','Constraint','Evidence'])
        for s in SCENES:
            for shot in s['shots']:writer.writerow([s['id'],shot['id'],stamp(shot['start']),stamp(shot['end']),s['chapter'],s['title'],s['role'],s['route'],shot['voiceover'],shot['action'],s['overlay'],s['presenter_note'],','.join(s['evidence'])])
    brief='''---
workflow: general-video
flow: companion
storyboard: yes
language: Taglish
audience: DTS staff demonstration
format: 1920x1080
length: 32m master and 3m alternate cut
deliverable: script and storyboard only
---

# DTS showcase production brief

## Confirmed request

The user wants a comprehensive script discussing every part of DTS, with a matching storyboard for video generation or presentation. The user selected Taglish for a staff demonstration. The current application files and verified stress results are the factual source.

## Production defaults

A desktop 16:9 master follows one ordinary document end to end, then reports, schedules, administration and verified performance. One scene ID and one timecode are shared across narration, storyboard and shot exports. The master is scheduled for 32 minutes including demonstration holds; the three-minute script is a separate overview.

## Scope boundary

Deliver editorial planning assets and a visual storyboard. All 32 keyframes include authentic reference stills from a disposable stress-test copy. Actual voice generation, media sourcing, action recordings, composition build, rendering and publication are later production work. The CLI usage check is unavailable locally, so usage is unknown. A future build should reconfirm scene layout and capture current screens before rendering.

## Handoff

Read showcase-plan.json for scene structure, exact narration, reference-image paths and scene-specific generation prompts. Read SCRIPT.md for presenter cues, STORYBOARD.md for frame metadata, storyboard.html for the visual review sheet and shot-list.csv for the 96 capture beats. Timing is advisory until voice and demonstration recordings exist.
'''
    (OUT/'BRIEF.md').write_text(brief,encoding='utf-8')

if __name__ == '__main__':
    plan=prepare();markdown(plan)
    print(json.dumps(dict(scenes=len(SCENES),shots=sum(len(s['shots']) for s in SCENES),spoken_words=sum(s['voiceover_words'] for s in SCENES),minutes=32),indent=2))

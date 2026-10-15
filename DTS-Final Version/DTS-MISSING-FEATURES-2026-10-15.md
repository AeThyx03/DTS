# DTS missing features — 15 October 2026

No corresponding application capability was found in the reviewed source.

**122 roadmap rows.** Repeated and overlapping requirements retain their original IDs; this is not a count of unique modules.

Full context: [Complete feature audit](<D:/test server/staging-dts/New folder/dts-final version-workflow/DTS-Final Version/FULL-FEATURE-AUDIT-2026-10-15.md>).

## Document intake and registration

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| A10 | Upload scanned documents, PDFs, and supporting files. | No binary file upload or attachment storage endpoint. |
| A11 | Record the physical folder, box, or cabinet location. | No physical storage-location fields. |
| A13 | Duplicate document detection using reference numbers and file hashes. | No reference-number duplicate warning or file-hash detection. |
| A14 | Bulk registration of multiple documents. | Bulk forwarding/release exists, but registration is one document at a time. |
| A15 | CSV/Excel import with column mapping and validation. | Only whole-system JSON backup restore; no CSV/Excel mapping importer. |
| A16 | Email-to-DTS intake or a dedicated upload inbox. | No mail intake or upload inbox. |
| A17 | QR code or barcode generation for physical folders. | No QR/barcode generation. |
| A18 | Batch scanning and attachment association. | No scanning or attachment ingestion. |
| A19 | Automatic acknowledgment receipts. | No acknowledgment receipt generation. |
| A20 | Registration templates for frequently received document types. | Configured reference types are not saved registration form templates. |

## Document tracking and lifecycle

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| B11 | Related-document links and parent-child relationships. | No parent-child or related-document records. |
| B15 | Physical-document location tracking. | No cabinet/folder/physical-location model. |

## Workflow and routing engine

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| C3 | Accept or acknowledge receipt of a forwarded document. | No recipient accept/acknowledge action. |
| C13 | Require supporting files before allowing a workflow transition. | No mandatory supporting-file gate. |
| C20 | Support escalation to a supervisor when a task becomes overdue. | No time-triggered escalation action. |

## Task and action management

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| D11 | Checklists for required processing steps. | No processing-step checklist model. |
| D17 | Create follow-up tasks linked to the original document. | No linked follow-up task objects. |

## SLA, deadlines, and overdue monitoring

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| E6 | Define cut-off times and rules for documents received after office hours. | No office-hour cutoff or after-hours intake rule. |
| E7 | Configure urgency-based deadlines. | Urgent is a label; no separate urgency-based deadline rule. |
| E11 | Escalate overdue documents to the focal person or supervisor. | No automatic supervisory escalation. |
| E13 | Record reasons for approved extensions. | No approval-backed extension action/reason history. |
| E14 | Distinguish active processing time from time awaiting an external party. | No external-wait state or auditable SLA pause/resume model. |

## Document processing and review tools

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| F2 | Store multiple versions of the same document. | Only current URLs and a counter; no stored historical file versions. |
| F6 | Compare two versions to identify changes. | No file/text comparison tool. |
| F9 | Maintain a checklist of required attachments. | No attachment checklist. |
| F18 | Prevent accidental overwriting of final or approved files. | No final-file lock/version protection; permitted users can replace linked files even after approval. |

## Incoming, outgoing, and internal communications

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| G3 | Receipt acknowledgment | No acknowledgment receipt. |
| G6 | Attachments checklist | No attachment checklist. |
| G12 | Delivery method | No structured delivery-channel field. |
| G13 | Proof of dispatch | A release event is recorded, but no proof-of-dispatch file/receipt. |
| G14 | Acknowledgment of receipt | No external receipt acknowledgment. |
| G22 | Retention schedules | No retention schedule. |
| G24 | Records disposition | No records-disposition workflow. |
| G25 | Physical file location | No physical location field. |
| G28 | Automatically associate a reply with the original incoming document. | No automatic reply-to-original relationship. |
| G29 | Generate a transmittal number for batches of outgoing documents. | No batch transmittal numbering. |
| G30 | Track delivery by courier, email, personal service, or other configured channels. | No courier/email/personal-service delivery tracking. |
| G32 | Link documents to a case, project, program, or transaction. | Document records have no case/project/program relationship; personnel inspection project text is separate. |
| G33 | Maintain a list of documents received from external offices that are still awaiting their response. | No awaiting-external-response lifecycle or queue. |

## User accounts, roles, and permissions

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| H3 | Division-level data restrictions. | Ordinary documents are not restricted to the user's division. |
| H4 | Confidentiality classifications. | No confidential/restricted classification. |
| H7 | Restrict administrator access to sensitive document content where appropriate. | System administrators have broad access; no sensitive-content exclusion. |
| H9 | Automatic expiration of temporary delegation. | Delegation does not expire automatically. |

## Search, filtering, and saved views

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| J9 | Search across attachment filenames and metadata. | No attachment metadata index. |
| J10 | Full-text search inside document contents where supported. | No content extraction/full-text index. |
| J11 | OCR-based search for scanned PDFs and images. | No OCR search. |
| J13 | Save frequently used filters as personal or shared views. | No named personal/shared saved views. |
| J14 | Pin frequently accessed searches. | No pinned search feature. |

## Notifications and reminders

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| K6 | Notifications when comments are added. | No comment-added notification delivery or unread event. |
| K8 | Deadline reminders at configurable intervals. | No scheduled reminder interval engine. |
| K10 | Notifications when a delegated assignment expires. | No expiring delegation or expiry alert. |
| K11 | Notification when an external response is received. | No external-response event notification. |
| K12 | Daily digest of pending and overdue work. | No daily digest. |
| K13 | Weekly summary for supervisors. | No weekly supervisor digest. |
| K14 | Read/unread state and notification history. | No notification read state/history. |
| K15 | User-configurable notification preferences. | No notification preference settings. |
| K16 | Email notifications through an approved mail server, if available. | No SMTP/mail delivery. |

## Reports and analytics

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| L20 | Archive and Retention Report. | No archive/retention model or report. |
| L22 | Opening backlog, new receipts, completed records, and closing backlog. | No opening/closing backlog reconciliation report. |
| L26 | Average time per workflow stage. | No aggregate average-duration metric for each historical stage. |
| L39 | Save frequently used report configurations. | No saved report configurations. |

## File management and Google Drive integration

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| M6 | Preview uploaded attachments. | No uploaded attachment store or renderer. |
| M7 | Display filename, file type, size, upload date, and uploader. | No attachment metadata records. |
| M9 | Validate file type and maximum upload size. | No file upload/type/size validation because uploads are absent. |
| M10 | Detect duplicate uploads. | No file-hash duplicate upload detection. |
| M11 | Generate secure download links. | No signed/expiring DTS download URL service. |
| M12 | Check whether linked files are accessible, where integration permits. | No authenticated Drive/repository accessibility check. |
| M15 | Retain metadata when a file is replaced or archived. | Old URLs and file metadata are not retained on replacement. |
| M16 | Enforce attachment access permissions. | DTS does not mediate external file permissions; ordinary record links are visible to all signed-in users. |

## Audit trail and accountability

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| N15 | Restrict and log access to sensitive records. | No sensitive classification/access log model. |

## Security, privacy, and data protection

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| O9 | Secure attachment handling and file type validation. | No managed attachment processing/type validation. |
| O10 | File upload size limits. | JSON request size caps exist; they are not attachment upload size limits. |
| O12 | Restricted access to confidential records. | No confidential-record restrictions. |
| O16 | Data retention and authorized disposal policies. | No retention/disposal policy engine. |
| O18 | Incident response and recovery procedures. | No documented incident response or tested disaster recovery runbook. |

## Backup, recovery, and system administration

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| P2 | Attachment backups. | Externally linked files are not copied/backed up. |
| P7 | Off-device or separate-server backup copies. | README advises off-machine copies, but no automated off-device backup implementation exists. |
| P18 | Maintenance mode and controlled deployments. | No maintenance switch or staged deployment/rollback system. |

## Bulk operations and data portability

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| Q1 | CSV/Excel import templates. | No CSV/Excel import templates. |
| Q2 | Import preview before committing data. | Restore shows counts/confirmation, not row-level import preview. |
| Q3 | Field mapping. | No import column mapping. |
| Q5 | Row-level error reports. | No row-level import error report. |
| Q7 | Bulk assignment. | Batch options are forward/release/delete/print/CSV; staff assignment remains per document. |
| Q8 | Bulk categorization. | No bulk document-type/category update. |
| Q9 | Bulk archival for authorized users. | No archive lifecycle or bulk archive. |
| Q11 | Export of selected fields only. | Hidden columns do not change fixed CSV export columns. |
| Q12 | Export attachments as a controlled ZIP package, if needed. | No attachment ZIP export. |

## User experience and interface design

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| R11 | Detail page organized into tabs. | Document detail uses stacked cards/history rather than tabbed detail sections. |
| R24 | User preferences for table density and default landing page. | No density/default-landing-page preference. |

## Automation and productivity features

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| S5 | Automatically escalate overdue documents. | No escalation engine. |
| S6 | Automatically generate daily pending-document summaries. | No scheduled pending-document digest. |
| S7 | Automatically flag documents missing mandatory attachments. | No required-attachment model/validator. |
| S8 | Automatically create follow-up tasks. | No follow-up task creation. |
| S11 | Automatically archive eligible completed records, subject to policy. | No automatic archive/retention job. |

## Collaboration and team coordination

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| T2 | @mentions for authorized users. | No mentions or mention notifications. |
| T8 | Follow-up reminders. | No follow-up reminder scheduler. |
| T9 | Related-document linking. | No linked related-document records. |
| T10 | Team announcements. | No team announcement module. |
| T14 | Explicit acknowledgment of important instructions. | No instruction acknowledgment/read receipt. |

## Integrations

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| U2 | SMTP email notifications. | No SMTP integration. |
| U3 | LDAP or Active Directory authentication, if available. | No directory/LDAP authentication. |
| U4 | Agency single sign-on, if supported. | No agency SSO/OIDC/SAML integration. |
| U5 | Microsoft Office document preview or conversion. | No native Office conversion/preview integration. |
| U7 | QR code generation for physical documents. | No QR generation. |
| U8 | Barcode scanning. | No barcode scan input workflow. |
| U9 | Scanner-assisted intake. | No scanner integration. |
| U11 | Approved e-signature service. | No e-signature integration. |
| U13 | Webhooks for configured workflow events. | No event webhooks. |
| U14 | OCR service for scanned documents. | No OCR service. |

## Advanced and experimental features

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| V1 | OCR and full-text indexing. | No OCR/content extraction/index. |
| V2 | Document comparison. | No version comparison tool. |
| V3 | AI-assisted classification. | Manual classification only; no AI suggestions. |
| V5 | Semantic document search. | Only literal metadata search. |
| V6 | Automatic metadata extraction. | No file metadata/text extraction. |
| V7 | Duplicate-content detection. | No content hash or similarity duplicate detection. |
| V8 | Suggested responses. | No generated response suggestions. |
| V9 | Document summarization. | No document summarization. |
| V11 | Estimated completion dates. | No predicted completion-date model. |

## Performance and technical reliability

| ID | Roadmap requirement | Existing behavior / remaining gap |
| --- | --- | --- |
| W2 | Efficient server-side filtering, sorting, and pagination. | Ordinary document filtering/sorting/pagination happen in the browser after downloading state. |
| W9 | Graceful handling of interrupted uploads. | No resumable/interrupted upload handling; binary uploads are absent. |
| W10 | File size and storage usage monitoring. | No storage usage/file-size monitor. |
| W15 | Recovery procedures for failed deployments. | No failed-deployment rollback/recovery runbook. |


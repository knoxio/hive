# CH-012: File/Image Sharing in Messages

**As a** room participant, **I want to** share files and images in room messages, **so that** I can exchange screenshots, logs, documents, and other artifacts without leaving the chat.

**Complexity:** L
**Priority:** P3
**Phase:** Can Have

## Dependencies
- File storage backend (local filesystem or object storage)
- Room messaging API (support for attachment metadata in messages)
- Authentication/authorization

## Acceptance Criteria
- [ ] Users can upload files via drag-and-drop or file picker in the chat UI
- [ ] Supported file types: images (PNG, JPG, GIF, SVG), text files, logs, PDFs, and archives (ZIP, tar.gz)
- [ ] Uploaded files are stored server-side with unique IDs and accessible via URL
- [ ] Images are displayed inline as thumbnails with click-to-expand
- [ ] Non-image files are displayed as download links with filename, size, and type icon
- [ ] File size limit is configurable (default: 10 MB per file)
- [ ] Total storage quota per workspace is configurable and enforced
- [ ] Files are scanned for basic validation (not executable, within size limit)
- [ ] File messages include the attachment metadata in the wire format (new `attachments` field)
- [ ] Files can be downloaded by any room member; access is controlled by room membership
- [ ] CLI support: `room send <room> -t <token> --file <path>` uploads and sends
- [ ] Unit tests cover file upload validation (size, type, quota)
- [ ] Integration test uploads a file and verifies it is retrievable and displayed in the room

## Technical Notes
- Wire format extension: add optional `attachments: [{id, filename, size, mime_type, url}]` to Message type
- Start with local filesystem storage (`~/.room/data/files/`); migrate to S3/R2 later
- Generate thumbnails server-side for images (avoid sending full-resolution inline)
- Consider content-addressable storage (hash-based filenames) for deduplication

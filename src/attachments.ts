/**
 * Generate a Blob URL, and remember it so that we can unload it if we
 * navigate away from the page.
 */

const blobURLs = <Array<string>> [];

function createObjectURL(
  blob: Blob
) : string {

  var blobURL = URL.createObjectURL(blob);

  blobURLs.push(blobURL);

  return blobURL;
}

/**
 * Unload any generated Blob URLs that we remember.
 */

function revokeObjectURLs() : void {
  for (var i = 0; i < blobURLs.length; i++) {
    URL.revokeObjectURL(blobURLs[i]);
  }

  blobURLs.splice(0, blobURLs.length);
}

/**
 * Download the attachment mentioned in the specified link, and then invoke a callback
 * once the download has completed.
 */

function downloadAttachment(
  checkbox: HTMLInputElement,
  callback: (href: string, blob: Blob) => void
) : void {

  var href = <string> checkbox.getAttribute('data-href');
  var download = <string> checkbox.getAttribute('data-download');
  var link = <HTMLAnchorElement> document.querySelector('.lesa-ui-attachment-info a[href="' + href + '"]');

  link.classList.add('downloading');

  downloadFile(
    href, download,
    function(blob: Blob) : void {
      link.classList.remove('downloading');
      callback(href, blob);
  });

  var xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';

  xhr.open('GET', href);
  xhr.send(null);
}

/**
 * Generate a single object representing the metadata for the attachment.
 */

function extractAttachmentLinkMetadata(
  attachmentLink: HTMLAnchorElement
) : AttachmentLinkMetadata {

  var comment = <HTMLDivElement> attachmentLink.closest('div[data-comment-id]');

  // Since we're using the query string in order to determine the name (since the actual text
  // in the link has a truncated name), we need to decode the query string.

  var encodedFileName = attachmentLink.href.substring(attachmentLink.href.indexOf('?') + 6);
  encodedFileName = encodedFileName.replace(/\+/g, '%20');
  var attachmentFileName = decodeURIComponent(encodedFileName);

  var authorElement = <HTMLElement> comment.querySelector('div.actor .name');
  var timeElement = <HTMLTimeElement> comment.querySelector('time');

  return {
    text: attachmentFileName,
    href: attachmentLink.href,
    download: attachmentFileName,
    commentId: <string> comment.getAttribute('data-comment-id'),
    author: <string> authorElement.textContent,
    time: timeElement.title,
    timestamp: <string> timeElement.getAttribute('datetime'),
    missingCorsHeader: false
  };
}

/**
 * Generate a single object representing the metadata for an external link.
 */

function extractExternalLinkMetadata(
  externalLink: HTMLAnchorElement
) : AttachmentLinkMetadata {

  var comment = <HTMLDivElement> externalLink.closest('div[data-comment-id]');

  var authorElement = <HTMLElement> comment.querySelector('div.actor .name');
  var timeElement = <HTMLTimeElement> comment.querySelector('time');

  // Since we're using the query string in order to determine the name (since the actual text
  // in the link has a truncated name), we need to decode the query string.

  return {
    text: <string> externalLink.textContent,
    href: externalLink.href,
    download: <string> externalLink.textContent,
    commentId: <string> comment.getAttribute('data-comment-id'),
    author: <string> authorElement.textContent,
    time: timeElement.title,
    timestamp: <string> timeElement.getAttribute('datetime'),
    missingCorsHeader: true
  }
}

/**
 * Generate a single row in the attachment table based on the provided link.
 */

function addAttachmentRow(
  container: HTMLDivElement,
  attachment: AttachmentLinkMetadata
) : void {

  var attachmentLink = createAnchorTag(attachment.text, attachment.href, attachment.download);
  attachmentLink.classList.add('attachment');
  container.appendChild(attachmentLink);

  // Attach an author and a timestamp. We'll have the timestamp be a comment permalink, since
  // other parts in this script provide us with that functionality.

  var attachmentExtraInfo = document.createElement('div');
  attachmentExtraInfo.classList.add('lesa-ui-attachment-extra-info');

  attachmentExtraInfo.appendChild(document.createTextNode(attachment.author + ' on '));

  var attachmentCommentLink = createAnchorTag(attachment.time, null);
  attachmentCommentLink.classList.add('attachment-comment-link');
  attachmentCommentLink.onclick = highlightComment.bind(null, attachment.commentId);

  attachmentExtraInfo.appendChild(attachmentCommentLink)
  container.appendChild(attachmentExtraInfo);

  var attachmentCheckbox = document.createElement('input');
  attachmentCheckbox.setAttribute('type', 'checkbox');

  attachmentCheckbox.setAttribute('data-text', attachment.text);
  attachmentCheckbox.setAttribute('data-download', attachment.download);
  attachmentCheckbox.setAttribute('data-href', attachment.href);

  if (attachment.missingCorsHeader) {
    attachmentCheckbox.disabled = true;
    attachmentCheckbox.setAttribute('title', 'The domain where this attachment is hosted does not send proper CORS headers, so it is not eligible for bulk download.')
  }
  else {
    attachmentCheckbox.checked = true;
  }

  container.appendChild(attachmentCheckbox);
}

/**
 * Generate a zip file containing all attachments for the specified ticket.
 */

function createAttachmentZip(
  ticketId: string,
  ticketInfo: TicketMetadata
) : void {

  var instance = <HTMLAnchorElement> this;

  var attachmentLinks = <Array<HTMLInputElement>> Array.from(document.querySelectorAll('div[data-side-conversations-anchor-id="' + ticketId + '"] .lesa-ui-attachment-info input[type="checkbox"]'));

  var attachmentCount = 0;

  for (var i = 0; i < attachmentLinks.length; i++) {
    attachmentLinks[i].disabled = true;

    if (attachmentLinks[i].checked) {
      ++attachmentCount;
    }
  }

  if (attachmentCount == 0) {
    return;
  }

  instance.classList.add('downloading');

  var downloadCount = 0;

  var zip = new JSZip();

  for (var i = 0; i < attachmentLinks.length; i++) {
    if (!attachmentLinks[i].checked) {
      continue;
    }

    downloadAttachment(
      attachmentLinks[i],
      function(fileName: string, blob: Blob) : void {
        if (blob) {
          zip.file(fileName, blob);
        }

        if (++downloadCount < attachmentCount) {
          return;
        }

        instance.classList.remove('downloading');
        instance.classList.add('generating');

        zip.generateAsync({
          type: 'blob'
        }).then(function(blob: Blob) {
          var accountCode = getAccountCode(ticketId, ticketInfo) || 'UNKNOWN';
          var zipFileName = accountCode + '.zendesk-' + ticketId + '.zip';

          var downloadLink = createAnchorTag('Download ' + zipFileName, URL.createObjectURL(blob), zipFileName);
          downloadLink.classList.add('.lesa-ui-attachments-download-blob');

          var parentElement = <HTMLElement>instance.parentElement;
          parentElement.replaceChild(downloadLink, instance);
        });
      })
  }
}

/**
 * Function to check if this is a large attachment, since those cannot be automatically
 * included in attachment .zip files due to CORS policies.
 */

function isLiferayLargeAttachment(anchor: HTMLAnchorElement) : boolean {
  return anchor.href.indexOf('ticketAttachmentId') != -1;
}

/**
 * Create a container to hold all of the attachments in the ticket, and a convenience
 * link which allows the user to download all of the selected attachments at once.
 */

function createAttachmentsContainer(
  ticketId: string,
  ticketInfo: TicketMetadata,
  conversation: HTMLDivElement
) : HTMLDivElement | null {

  var attachmentLinks = <Array<HTMLAnchorElement>> Array.from(conversation.querySelectorAll('.attachment'));

  var externalLinks = <Array<HTMLAnchorElement>> Array.from(conversation.querySelectorAll('.is-public .zd-comment > a:not(.attachment)'));
  externalLinks = externalLinks.filter(isLiferayLargeAttachment);

  if (attachmentLinks.length + externalLinks.length == 0) {
    return null;
  }

  var attachmentsContainer = document.createElement('div');
  attachmentsContainer.classList.add('lesa-ui-attachments');

  var attachmentsLabel = document.createElement('div');
  attachmentsLabel.classList.add('lesa-ui-attachments-label');
  attachmentsLabel.innerHTML = 'Attachments:';

  attachmentsContainer.appendChild(attachmentsLabel);

  var attachmentsWrapper = document.createElement('div');

  // Accumulate the attachments, and then sort them by date

  var attachments = [];

  for (var i = 0; i < attachmentLinks.length; i++) {
    attachments.push(extractAttachmentLinkMetadata(attachmentLinks[i]));
  }

  for (var i = 0; i < externalLinks.length; i++) {
    attachments.push(extractExternalLinkMetadata(externalLinks[i]));
  }

  attachments.sort(function(a, b) {
    return a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 :
      a.text > b.text ? 1 : a.text < b.text ? -1 : 0;
  })

  // Generate the table and a 'bulk download' link for convenience

  var attachmentInfo = document.createElement('div');
  attachmentInfo.classList.add('lesa-ui-attachment-info');

  for (var i = 0; i < attachments.length; i++) {
    addAttachmentRow(attachmentInfo, attachments[i]);
  }

  attachmentsWrapper.appendChild(attachmentInfo);

  if (JSZip) {
    var downloadAllContainer = document.createElement('div');
    downloadAllContainer.classList.add('lesa-ui-attachments-bulk-download');

    var attachmentsZipLink = createAnchorTag('Generate Bulk Download', null);
    attachmentsZipLink.onclick = createAttachmentZip.bind(null, attachmentsZipLink, attachmentsZipLink, ticketId, ticketInfo);

    downloadAllContainer.appendChild(attachmentsZipLink);

    attachmentsWrapper.appendChild(downloadAllContainer);
  }

  attachmentsContainer.appendChild(attachmentsWrapper);

  return attachmentsContainer;
}
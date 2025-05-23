function addArticleCodeButton(
  toolbar : HTMLElement,
  tinymce : TinyMCE
) : void {
  // Creates the code format container button
  var codeFormatButton = document.createElement('div');
  codeFormatButton.classList.add('ssc-view-3d4f1d68', 'src-components-EditorToolbar-ToolbarButton---button---2IfvR');
  codeFormatButton.setAttribute('tabindex', '0');
  codeFormatButton.setAttribute('role', 'button');
  codeFormatButton.setAttribute('id', 'custom-code-format-button');
  codeFormatButton.setAttribute('data-test-id', 'toolbarCodeFormatButton');

  // Creates the code format label
  var codeFormatLabel = document.createElement('div');
  codeFormatLabel.classList.add('src-components-EditorToolbar-ToolbarButton---label---PACxZ');
  codeFormatLabel.setAttribute('title', 'Code Format');

  // Creates the code format icon
  var codeFormatIcon = document.createElement('img');
  codeFormatIcon.setAttribute('src', 'https://www.tiny.cloud/docs/images/icons/code-sample.svg'); // Icon taken from https://www.tiny.cloud/docs/advanced/editor-icon-identifiers/
  codeFormatIcon.setAttribute('alt', "code format")

  // Adds icon to the label
  codeFormatLabel.appendChild(codeFormatIcon);

  // Adds the label to the button
  codeFormatButton.appendChild(codeFormatLabel);

  // Adds the button to the toolbar
  var toolbarPreButton = <HTMLDivElement> toolbar.querySelector('div[data-test-id="toolbarPreButton"]');
  toolbar.insertBefore(codeFormatButton, toolbarPreButton);

  // Registers the button functionality
  // API: https://www.tiny.cloud/docs/api/tinymce/tinymce.formatter/
  var registerArguments = {
    inline: 'code'
  };

  if (cloneInto) {
    registerArguments = cloneInto(registerArguments, unsafeWindow);
  }

  tinymce.activeEditor.formatter.register('codeformat', registerArguments);

  // Adds function to the button
  codeFormatButton.addEventListener('click', function(e: Event) {
    var target = <HTMLElement> e.currentTarget;
    tinymce.activeEditor.focus();
    tinymce.activeEditor.formatter.toggle('codeformat');
    tinymce.DOM.toggleClass(target, 'src-components-EditorToolbar-ToolbarButton---active---3qTSV');
  })

  // Adds event listener to check <code> markup everywhere on the active editor
  var checkIfInCodeTag = function(e: TinyMCENodeChangeEvent) {
    if (e.element.nodeName == 'CODE') {
      codeFormatButton.classList.add('src-components-EditorToolbar-ToolbarButton---active---3qTSV');
    } else {
      codeFormatButton.classList.remove('src-components-EditorToolbar-ToolbarButton---active---3qTSV');
    }
  };

  if (exportFunction) {
    checkIfInCodeTag = exportFunction(checkIfInCodeTag, unsafeWindow);
  }

  tinymce.activeEditor.on('NodeChange', checkIfInCodeTag);
}

function wrapLiferayGatedContent(tinymce : TinyMCE) : void {
  // Only runs if on a KCS

  var isFastTrack = Array.from(document.querySelectorAll([
    'div[data-test-id="sectionSelector-section"]', // Visible when sidebar is open
    'div[data-test-id="section-name"]'             // Visible when sidebar is closed
  ].join(','))).filter(x => x.textContent == 'Fast Track').length > 0;

  if (!isFastTrack) {
    return;
  }

  var allEditorH2 = tinymce.activeEditor.contentDocument.getElementsByTagName('h2');

  for (var i = 0; i < allEditorH2.length; i++) {
    if ((allEditorH2[i].textContent == 'Resolution' || allEditorH2[i].textContent == 'Additional Information') &&
      (<HTMLElement> allEditorH2[i].nextSibling).tagName != 'DIV') {
      tinymce.dom.DomQuery(allEditorH2[i]).nextUntil().wrapAll('<div>');
    }
  }
}

function addArticleSubmissionListeners(tinymce : TinyMCE) : void {
  var validationButtons = document.querySelectorAll([
    'div[data-test-id="createButton-menu-button"]', // appears when first creating a KCS
    'div[data-test-id="updateButton-menu-button"]'  // appears when updating an existing one
  ].join(','));

  for (var i = 0; i < validationButtons.length; i++) {
    var button = validationButtons[i];

    if (button.classList.contains('lesa-ui-button-listen')) {
      continue;
    }

    button.classList.add('lesa-ui-button-listen');

    button.addEventListener('click', wrapLiferayGatedContent.bind(null, tinymce));
  }
}

function addArticleFormattingButtons(tinymce : TinyMCE) : void {
  var preButtons = <Array<HTMLDivElement>> Array.from(document.querySelectorAll('div[data-test-id="toolbarPreButton"]'));

  for (var i = 0; i < preButtons.length; i++) {
    var toolbar = preButtons[i].parentElement;

    if (toolbar == null || toolbar.classList.contains('lesa-ui-stackedit')) {
      continue;
    }

    toolbar.classList.add('lesa-ui-stackedit');

    addArticleCodeButton(toolbar, tinymce);
  }
}

function updateKnowledgeCenterEditor() {
  var tinymce = unsafeWindow.tinymce;

  if (!tinymce) {
    return;
  }

  addArticleFormattingButtons(tinymce);
  addArticleSubmissionListeners(tinymce);
}

function updateFastTrackArticle() {
  if ((document.location.pathname.indexOf('/hc/') != 0) || (document.location.pathname.indexOf('/articles/') == -1)) {
    return;
  }

  var metaElement = document.querySelector('div.article-author .article-meta');

  if (metaElement == null) {
    return;
  }

  if (metaElement.classList.contains('lesa-ui-article-linked')) {
    return;
  }

  metaElement.classList.add('lesa-ui-article-linked');

  var articleLinksElement = document.createElement('div');
  metaElement.appendChild(articleLinksElement);

  articleLinksElement.classList.add('meta-group', 'secondary-font', 'secondary-text-color');
  articleLinksElement.style.gap = '0.5em';

  var articleId = document.location.pathname.substring(document.location.pathname.lastIndexOf('/') + 1);

  var pos = articleId.indexOf('-');

  if (pos != -1) {
    articleId = articleId.substring(0, pos);
  }

  var requestURL = document.location.origin + '/api/v2/help_center/articles/' + articleId + '.json';

  GM.xmlHttpRequest({
    'method': 'GET',
    'url': requestURL,
    'headers': {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      'Pragma': 'no-cache'
    },
    'responseType': 'blob',
    'onload': function(xhr: XMLHttpRequest) {
      var payload = JSON.parse(xhr.responseText);
      var labelNames = ((payload && payload.article && payload.article.label_names) ? payload.article.label_names : []) as string[];

      var ticketIds = labelNames.filter((it) => it.match(/^[0-9]+$/g));

      var ticketLinks = ticketIds.map((it) => createAnchorTag('https://liferay-support.zendesk.com/agent/tickets/' + it, 'https://liferay-support.zendesk.com/agent/tickets/' + it));

      if (ticketLinks.length > 0) {
        for (var ticketLink of ticketLinks) {
          articleLinksElement.appendChild(ticketLink);
        }
      }
      else {
        articleLinksElement.remove();
      }
    },
    'onerror': function(xhr: XMLHttpRequest) {
    }
  });
}
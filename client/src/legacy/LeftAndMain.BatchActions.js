/**
 * File: LeftAndMain.BatchActions.js
 */
import $ from 'jquery';
import i18n from 'i18n';

$.entwine('ss.tree', function($){

  /**
   * Class: #Form_BatchActionsForm
   *
   * Batch actions which take a bunch of selected pages,
   * usually from the CMS tree implementation, and perform serverside
   * callbacks on the whole set. We make the tree selectable when the jQuery.UI tab
   * enclosing this form is opened.
   *
   * Events:
   *  register - Called before an action is added.
   *  unregister - Called before an action is removed.
   */
  $('#Form_BatchActionsForm').entwine({

    /**
     * Variable: Actions
     * (Array) Stores all actions that can be performed on the collected IDs as
     * function closures. This might trigger filtering of the selected IDs,
     * a confirmation message, etc.
     */
    Actions: [],

    getTree: function() {
      return $('.cms-tree');
    },

    fromTree: {
      oncheck_node: function(e, data){
        this.serializeFromTree();
      },
      onuncheck_node: function(e, data){
        this.serializeFromTree();
      }
    },

    onmatch: function () {
      var self = this;

      self.getTree()
      .bind('load_node.jstree', function (e, data) {
        self.refreshSelected();
      });
    },

    onunmatch: function () {
      var self = this;

      self.getTree()
        .unbind('load_node.jstree');
    },

    /**
     * @func registerDefault
     * @desc Register default bulk confirmation dialogs
     */
    registerDefault: function() {
      var self = this;

      // Publish selected pages action
      this.register('publish', function(ids) {
        var confirmed = confirm(
          i18n.inject(
            i18n._t(
              "Admin.BATCH_PUBLISH_PROMPT",
              "You have {num} page(s) selected.\n\nDo you really want to publish?"
            ),
            {'num': ids.length}
          )
        );
        return (confirmed) ? ids : false;
      });

      // Unpublish selected pages action
      this.register('unpublish', function(ids) {
        var confirmed = confirm(
          i18n.inject(
            i18n._t(
              "Admin.BATCH_UNPUBLISH_PROMPT",
              "You have {num} page(s) selected.\n\nDo you really want to unpublish"
            ),
            {'num': ids.length}
          )
        );
        return (confirmed) ? ids : false;
      });

      // Delete and archive selected pages action
      this.register('delete', function(ids) {
        return self.fetchConfirmation(ids, 'delete');
      });

      // Archive selected pages action (may be registered by silverstripe-cms,
      // but we provide the default here for consistency)
      this.register('archive', function(ids) {
        return self.fetchConfirmation(ids, 'archive');
      });

      // Restore selected archived pages
      this.register('restore', function(ids) {
        var confirmed = confirm(
          i18n.inject(
            i18n._t(
              "Admin.BATCH_RESTORE_PROMPT",
              "You have {num} page(s) selected.\n\nDo you really want to restore to stage?\n\nChildren of archived pages will be restored to the root level, unless those pages are also being restored."
            ),
            {'num': ids.length}
          )
        );
        return (confirmed) ? ids : false;
      });
    },

    onadd: function() {
      this.registerDefault();
      this._super();
    },

    /**
     * @func fetchConfirmation
     * @desc Fetch descendant count from the server and show an appropriate
     *       confirmation modal. Falls back to a static confirm() if the
     *       server request fails.
     * @param {array} ids - Selected page IDs
     * @param {string} actionType - 'delete' or 'archive'
     * @return {jQuery.Deferred} Resolves with ids if confirmed, false if cancelled
     */
    fetchConfirmation: function(ids, actionType) {
      var deferred = $.Deferred();
      var self = this;
      var actionUrl = this.find(':input[name=Action]').val();
      var upperType = actionType.toUpperCase();

      // Fallback i18n keys
      var fallbackKey = 'Admin.BATCH_' + upperType + '_PROMPT';
      var fallbackMsg = (actionType === 'archive')
        ? "You have {num} page(s) selected.\n\nAre you sure you want to archive these pages?\n\nThese pages and all of their children pages will be unpublished and sent to the archive."
        : "You have {num} page(s) selected.\n\nAre you sure you want to delete these pages?\n\nThese pages and all of their children pages will be deleted and sent to the archive.";

      if (!actionUrl) {
        deferred.resolve(false);
        return deferred.promise();
      }

      // Build the confirmation endpoint URL
      var actionUrlParts = $.path.parseUrl(actionUrl);
      var confirmUrl = actionUrlParts.hrefNoSearch + '/confirmation/';
      confirmUrl = $.path.addSearchParams(confirmUrl, actionUrlParts.search);
      confirmUrl = $.path.addSearchParams(confirmUrl, { csvIDs: ids.join(',') });

      jQuery.ajax({
        url: confirmUrl,
        type: 'GET',
        dataType: 'json',
        success: function(data) {
          if (data && data.descendantCount > 0) {
            // Pages have descendants — show a prominent warning modal
            var title = i18n._t(
              'Admin.BATCH_' + upperType + '_CONFIRM_TITLE',
              actionType.charAt(0).toUpperCase() + actionType.slice(1) + ' pages'
            );
            var bodyMsg = i18n.inject(
              i18n._t(
                'Admin.BATCH_' + upperType + '_PROMPT_WITH_DESCENDANTS',
                "You have {num} page(s) selected.\n\nWARNING: These pages have a total of {descendantCount} child/descendant page(s) that will ALSO be " + actionType + "d.\n\nThis action may be difficult to undo."
              ),
              { 'num': ids.length, 'descendantCount': data.descendantCount }
            );
            var confirmLabel = i18n.inject(
              i18n._t(
                'Admin.BATCH_' + upperType + '_CONFIRM_BUTTON',
                actionType.charAt(0).toUpperCase() + actionType.slice(1) + ' {total} pages'
              ),
              { 'total': ids.length + data.descendantCount }
            );
            self._showConfirmModal(title, bodyMsg, confirmLabel, function() {
              deferred.resolve(ids);
            }, function() {
              deferred.resolve(false);
            });
          } else {
            // No descendants — show a simple confirm
            var message = i18n.inject(
              i18n._t(
                'Admin.BATCH_' + upperType + '_PROMPT_NO_DESCENDANTS',
                "You have {num} page(s) selected.\n\nAre you sure you want to " + actionType + " these pages?"
              ),
              { 'num': ids.length }
            );
            // eslint-disable-next-line no-alert
            var confirmed = confirm(message);
            deferred.resolve(confirmed ? ids : false);
          }
        },
        error: function() {
          // Fallback to static confirm() if the server endpoint fails
          // eslint-disable-next-line no-alert
          var confirmed = confirm(
            i18n.inject(
              i18n._t(fallbackKey, fallbackMsg),
              { 'num': ids.length }
            )
          );
          deferred.resolve(confirmed ? ids : false);
        }
      });

      return deferred.promise();
    },

    /**
     * @func _showConfirmModal
     * @desc Show a Bootstrap modal for destructive action confirmation.
     * @param {string} title - Modal title
     * @param {string} bodyText - Warning message (newlines converted to <br>)
     * @param {string} confirmLabel - Text for the confirm button
     * @param {function} onConfirm - Called when the user confirms
     * @param {function} onCancel - Called when the user cancels
     */
    _showConfirmModal: function(title, bodyText, confirmLabel, onConfirm, onCancel) {
      // Remove any existing modal
      $('#batch-action-confirm-modal').remove();

      // Convert newlines to HTML breaks and highlight WARNING text
      var bodyHtml = $('<div/>').text(bodyText).html()
        .replace(/\n/g, '<br>')
        .replace(
          /WARNING:/g,
          '<strong style="color: #d32f2f; font-size: 1.1em;">WARNING:</strong>'
        );

      var modal = $(
        '<div class="modal fade" id="batch-action-confirm-modal" tabindex="-1" role="dialog">' +
          '<div class="modal-dialog" role="document">' +
            '<div class="modal-content">' +
              '<div class="modal-header">' +
                '<h4 class="modal-title">' + $('<span/>').text(title).html() + '</h4>' +
                '<button type="button" class="close" data-dismiss="modal" aria-label="Close">' +
                  '<span aria-hidden="true">&times;</span>' +
                '</button>' +
              '</div>' +
              '<div class="modal-body">' +
                '<p>' + bodyHtml + '</p>' +
              '</div>' +
              '<div class="modal-footer">' +
                '<button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>' +
                '<button type="button" class="btn btn-danger" id="batch-action-confirm-btn">' +
                  $('<span/>').text(confirmLabel).html() +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );

      var resolved = false;
      modal.find('#batch-action-confirm-btn').on('click', function() {
        resolved = true;
        modal.modal('hide');
        if (onConfirm) onConfirm();
      });

      modal.on('hidden.bs.modal', function() {
        modal.remove();
        if (!resolved && onCancel) onCancel();
      });

      $('body').append(modal);
      modal.modal('show');
    },

    /**
     * @func _submitAction
     * @desc Submit the batch action via AJAX. Extracted from onsubmit
     *       to support both sync and async confirmation flows.
     * @param {string} actionURL
     */
    _submitAction: function(actionURL) {
      var self = this,
        tree = this.getTree();

      // Reset failure states
      tree.find('li').removeClass('failed');

      var button = this.find(':submit:first');
      button.addClass('loading');

      jQuery.ajax({
        url: actionURL,
        type: 'POST',
        data: this.serializeArray(),
        complete: function(xmlhttp, status) {
          button.removeClass('loading');
          tree.jstree('refresh', -1);
          self.setIDs([]);
          self.find(':input[name=Action]').val('').change();

          var msg = xmlhttp.getResponseHeader('X-Status');
          if(msg) statusMessage(decodeURIComponent(msg), (status == 'success') ? 'good' : 'bad');
        },
        success: function(data, status) {
          var id, node;

          if(data.modified) {
            var modifiedNodes = [];
            for(id in data.modified) {
              node = tree.getNodeByID(id);
              tree.jstree('set_text', node, data.modified[id]['TreeTitle']);
              modifiedNodes.push(node);
            }
            $(modifiedNodes).effect('highlight');
          }
          if(data.deleted) {
            for(id in data.deleted) {
              node = tree.getNodeByID(id);
              if(node.length)  tree.jstree('delete_node', node);
            }
          }
          if(data.error) {
            for(id in data.error) {
              node = tree.getNodeByID(id);
              $(node).addClass('failed');
            }
          }
        },
        dataType: 'json'
      });
    },

    /**
     * @func register
     * @param {string} type
     * @param {function} callback
     */
    register: function(type, callback) {
      this.trigger('register', {type: type, callback: callback});
      var actions = this.getActions();
      actions[type] = callback;
      this.setActions(actions);
    },

    /**
     * @func unregister
     * @param {string} type
     * @desc Remove an existing action.
     */
    unregister: function(type) {
      this.trigger('unregister', {type: type});

      var actions = this.getActions();
      if(actions[type]) delete actions[type];
      this.setActions(actions);
    },

    /**
     * @func refreshSelected
     * @param {object} rootNode
     * @desc Ajax callbacks determine which pages is selectable in a certain batch action.
     */
    refreshSelected : function(rootNode) {
      var self = this,
        st = this.getTree(),
        ids = this.getIDs(),
        allIds = [],
        viewMode = $('.cms-content-batchactions-button'),
        actionUrl = this.find(':input[name=Action]').val();

      // Default to refreshing the entire tree
      if(rootNode == null) rootNode = st;

      for(var idx in ids) {
        $($(st).getNodeByID(idx)).addClass('selected').attr('selected', 'selected');
      }

      // If no action is selected, enable all nodes
      if(!actionUrl || actionUrl == -1 || !viewMode.hasClass('active')) {
        $(rootNode).find('li').each(function() {
          $(this).setEnabled(true);
        });
        return;
      }

      // Disable the nodes while the ajax request is being processed
      $(rootNode).find('li').each(function() {
        allIds.push($(this).data('id'));
        $(this).addClass('treeloading').setEnabled(false);
      });

      // Post to the server to ask which pages can have this batch action applied
      // Retain existing query parameters in URL before appending path
      var actionUrlParts = $.path.parseUrl(actionUrl);
      var applicablePagesUrl = actionUrlParts.hrefNoSearch + '/applicablepages/';
      applicablePagesUrl = $.path.addSearchParams(applicablePagesUrl, actionUrlParts.search);
      applicablePagesUrl = $.path.addSearchParams(applicablePagesUrl, {csvIDs: allIds.join(',')});
      jQuery.getJSON(applicablePagesUrl, function(applicableIDs) {
        // Set a CSS class on each tree node indicating which can be batch-actioned and which can't
        jQuery(rootNode).find('li').each(function() {
          $(this).removeClass('treeloading');

          var id = $(this).data('id');
          if(id == 0 || $.inArray(id, applicableIDs) >= 0) {
            $(this).setEnabled(true);
          } else {
            // De-select the node if it's non-applicable
            $(this).removeClass('selected').setEnabled(false);
            $(this).prop('selected', false);
          }
        });

        self.serializeFromTree();
      });
    },

    /**
     * @func serializeFromTree
     * @return {boolean}
     */
    serializeFromTree: function() {
      var tree = this.getTree(), ids = tree.getSelectedIDs();

      // write IDs to the hidden field
      this.setIDs(ids);

      return true;
    },

    /**
     * @func setIDS
     * @param {array} ids
     */
    setIDs: function(ids) {
      this.find(':input[name=csvIDs]').val(ids ? ids.join(',') : null);
    },

    /**
     * @func getIDS
     * @return {array}
     */
    getIDs: function() {
      // Map empty value to empty array
      var value = this.find(':input[name=csvIDs]').val();
      return value
        ? value.split(',')
        : [];
    },

    onsubmit: function(e) {
      var self = this,
        ids = this.getIDs(),
        actions = this.getActions();

      // if no nodes are selected, return with an error
      if(!ids || !ids.length) {
        alert(i18n._t('Admin.SELECTONEPAGE', 'Please select at least one page'));
        e.preventDefault();
        return false;
      }

      // apply callback, which might modify the IDs
      var actionURL = this.find(':input[name=Action]').val();
      if (!actionURL) {
        e.preventDefault();
        return false;
      }

      // Validate action
      var type = actionURL.split('/').filter(n => !!n).pop();
      var result = ids;
      if(actions[type]) {
        result = actions[type].apply(this, [ids]);
      }

      // Support async (Promise/Deferred) callbacks for actions that
      // need to fetch data from the server before confirming
      if (result && typeof result.then === 'function') {
        result.then(function(resolvedIds) {
          if (resolvedIds && resolvedIds.length) {
            self.setIDs(resolvedIds);
            self._submitAction(actionURL);
          }
        });
        e.preventDefault();
        return false;
      }

      // Synchronous path (existing behaviour for publish, unpublish, restore, etc.)
      ids = result;

      // Discontinue processing if there are no further items
      if(!ids || !ids.length) {
        e.preventDefault();
        return false;
      }

      // write (possibly modified) IDs back into to the hidden field
      this.setIDs(ids);
      this._submitAction(actionURL);

      // Never process this action; Only invoke via ajax
      e.preventDefault();
      return false;
    }

  });

  $('.cms-content-batchactions-button').entwine({
    onmatch: function () {
      this._super();
      this.updateTree();
    },
    onunmatch: function () {
      this._super();
    },
    onclick: function (e) {
      this.updateTree();
    },
    updateTree: function () {
      var tree = $('.cms-tree'),
        form = $('#Form_BatchActionsForm');

      this._super();

      if(this.data('active')) {
        tree.addClass('multiple');
        tree.removeClass('draggable');
        form.serializeFromTree();
      } else {
        tree.removeClass('multiple');
        tree.addClass('draggable');
      }

      $('#Form_BatchActionsForm').refreshSelected();
    }
  });

  /**
   * Class: #Form_BatchActionsForm :select[name=Action]
   */
  $('#Form_BatchActionsForm select[name=Action]').entwine({
    onchange: function(e) {
      var form = $(e.target.form),
        btn = form.find(':submit'),
        selected = $(e.target).val();

      // Refresh selected / enabled nodes
      $('#Form_BatchActionsForm').refreshSelected();

      // TODO Should work by triggering change() along, but doesn't - entwine event bubbling?
      this.trigger("chosen:updated");

      this._super(e);
    }
  });
});

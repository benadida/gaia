/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

// Retrieve service
var Service = getService(function ccapp_onServiceReady(evt) {
  // If the service is not ready, when ready it sets the Service object
  // again and setup the application.
  Service = evt.detail.service;
  setupSettings();
});
if (Service)
  setupSettings();

// Settings view is in charge of display and allow user interaction to
// changing the application customization.
function setupSettings() {

  var DEFAULTS = {
    'plantype': 'prepaid',
    'tracking_period': 'never',
    'reset_time': 1,
    'lowlimit': true,
    'lowlimit_threshold': 5
  };

  var _viewManager = new ViewManager();

  function _getEntryParent(item) {
    var current = item;
    while (current && current.tagName !== 'LI')
      current = current.parentNode;

    return current;
  }

  function _getDefaultValue(optionKey) {
    var defaultValue = DEFAULTS[optionKey];
    if (typeof defaultValue === 'function')
      defaultValue = defaultValue(Service.settings);
    return defaultValue;
  }

  var CONFIGURE_WIDGET = {
    'select': function ccapp_configureSelectWidget(guiWidget) {

      var dialog = document.getElementById(guiWidget.dataset.selectdialog);
      var optionKey = guiWidget.dataset.option;

      // Configure dialog
      var okButton = dialog.querySelector('button.affirmative');
      if (okButton) {
        okButton.addEventListener('click', function ccapp_onDialogOk() {
          var checked = dialog.querySelector('input[type="radio"]:checked');
          Service.settings.option(optionKey, checked.value);
          _viewManager.closeCurrentView();
        });
      }

      var cancelButton = dialog.querySelector('button.cancel');
      if (cancelButton) {
        cancelButton.addEventListener('click',
          function ccapp_onDialogCancel() {
            var currentValue = Service.settings.option(optionKey);
            Service.settings.option(optionKey, currentValue);
            _viewManager.closeCurrentView();
          }
        );
      }

      // Show the dialog
      guiWidget.addEventListener('click', function ccapp_onWidgetClick() {
        _viewManager.changeViewTo(dialog.id);
      });

      // Keep the widget and the dialog synchronized
      Service.settings.observe(optionKey,
        function ccapp_onOptionChange(value) {

          // Use default value if no value
          if (value === null || typeof value === 'undefined')
            value = _getDefaultValue(optionKey);

          var radio =
            dialog.querySelector('input[type="radio"][value="' + value + '"]');

          if (!radio) {
            value = _getDefaultValue(optionKey);
            radio = dialog.querySelector('input[type="radio"][value="' +
                                         value + '"]');
          }
          radio.checked = true;

          var textSpan = dialog.querySelector('input:checked + span');
          var tagSpan = guiWidget.querySelector('.tag');
          tagSpan.textContent = textSpan.textContent;
        }
      );

      // Keep the UI localized
      window.addEventListener('localized', function ccapp_onLocalized() {
        var textSpan = dialog.querySelector('input:checked + span');
        var tagSpan = guiWidget.querySelector('.tag');
        tagSpan.textContent = textSpan.textContent;
      });

    },

    'switch' : function ccapp_configureSwitch(guiWidget) {
      var optionKey = guiWidget.dataset.option;

      // Add an observer to keep synchronization
      Service.settings.observe(
        optionKey,
        function ccapp_onOptionChange(value) {

          // Use default value if no value
          if (value === null || typeof value === 'undefined')
            value = _getDefaultValue(optionKey);

          guiWidget.checked = value;
        }
      );

      // Add an event listener to switch the option
      guiWidget.addEventListener('click', function ccapp_onSwitchChange() {
        Service.settings.option(optionKey, guiWidget.checked);
      });
    },

    'input' : function ccapp_configureInput(guiWidget) {
      var optionKey = guiWidget.dataset.option;

      // Add an observer to keep synchronization
      Service.settings.observe(
        optionKey,
        function ccapp_onOptionChange(value) {

          // Use default value if no value
          if (value === null || typeof value === 'undefined')
            value = _getDefaultValue(optionKey);

          guiWidget.value = value;
        }
      );

      // Add an event listener to switch the option
      guiWidget.addEventListener('change', function ccapp_onSwitchChange() {
        var value = guiWidget.value;
        if (guiWidget.type === 'number')
          value = parseFloat(value);
        Service.settings.option(optionKey, value);
      });
    }
  };

  function _configureGUIWidgets() {

    function getWidgetType(widget) {
      if (typeof widget.dataset.selectdialog !== 'undefined')
        return 'select';

      if (widget.type === 'checkbox')
        return 'switch';

      if (['text', 'number'].indexOf(widget.type) !== -1)
        return 'input';
    }

    function installDependency(expression, callback) {
      var equality = false;
      var parsed = expression.split('!=');
      if (parsed.length === 1) {
        parsed = expression.split('=');
        equality = true;
      }

      var dependency = parsed[0];
      var referenceValue = parsed[1];
      Service.settings.observe(dependency,
        function ccapp_dependencyAction(value) {
          var test = (('' + value) === referenceValue);
          callback(equality === test); // or is an equality test and values are
                                       // equal or is an inequality test and
                                       // values are different.
        }
      );
    }

    // Widgets
    var allGUIWidgets = document.querySelectorAll('.localsetting');
    [].forEach.call(allGUIWidgets, function ccapp_eachWidget(guiWidget) {

      var type = getWidgetType(guiWidget);
      var entry = _getEntryParent(guiWidget);
      CONFIGURE_WIDGET[type](guiWidget);

      // Simple dependency resolution:

      // enable / disable some options depending on the values of other
      var disableOn = guiWidget.dataset.disableOn;
      if (disableOn) {
        installDependency(disableOn, function ccapp_toDisable(passed) {
          guiWidget.disabled = passed;
          if (entry)
            entry.setAttribute('aria-disabled', passed + '');
        });
      }

      // hide / show some options depending on the values of other
      var hideOn = guiWidget.dataset.hideOn;
      if (hideOn) {
        installDependency(hideOn, function ccapp_toHide(passed) {
          guiWidget.setAttribute('aria-hidden', passed + '');
          if (entry)
            entry.setAttribute('aria-hidden', passed + '');
        });
      }

    });
  }

  function _setBalanceView(balanceObj) {
    balanceObj = balanceObj || Service.getLastBalance();
    var settingsCurrency = document.getElementById('settings-currency');
    var settingsCredit = document.getElementById('settings-credit');
    var settingsTime = document.getElementById('settings-time');
    var settingsLowLimitCurrency =
      document.getElementById('settings-low-limit-currency');

    if (balanceObj) {
      settingsCurrency.textContent = balanceObj.currency;
      settingsLowLimitCurrency.textContent = balanceObj.currency;
      settingsCredit.textContent = formatBalance(balanceObj.balance);
      settingsTime.textContent = formatTime(balanceObj.timestamp);
    } else {
      settingsCurrency.textContent = '';
      settingsLowLimitCurrency.textContent = '';
      settingsCredit.textContent = '--';
      settingsTime.textContent = _('never');
    }
  }

  // Reset the balance view and attach a listener to keep the UI updated
  // when updating the balance.
  function _configureBalanceView() {
    _setBalanceView();
    Service.setBalanceCallbacks({
      onsuccess: function ccapp_onBalanceSuccess(evt) {
        var balance = evt.detail;
        _setBalanceView(balance);
      }
    });
  }

  // Shows the reset confirmation
  function _showResetConfirmation(callback) {
    var dialogId = 'reset-confirmation-dialog';
    var dialog = document.getElementById(dialogId);
    _viewManager.changeViewTo(dialogId);

    var cancel = dialog.querySelector('button.close-dialog');
    cancel.addEventListener('click', function ccapp_cancelConfimation() {
      _viewManager.closeCurrentView();
    });

    var confirm = dialog.querySelector('button.negative');
    confirm.addEventListener('click', function ccapp_onConfirm(evt) {
      _viewManager.closeCurrentView();
      callback(evt);
    });
  }

  // Read telephony information
  function _setTelephonyView() {
    function toMinutes(milliseconds) {
      return Math.ceil(milliseconds / (1000 * 60));
    }

    // Dates
    var formattedTime = _('never');
    var lastReset = Service.settings.option('lastreset');
    if (lastReset !== null)
      formattedTime = (new Date(lastReset))
                      .toLocaleFormat(_('short-date-format'));
    document.getElementById('telephony-from-date').textContent = formattedTime;

    var now = new Date();
    document.getElementById('telephony-to-date').textContent =
      _('today') + ', ' + now.toLocaleFormat('%H:%M');

    // Counters
    document.getElementById('calltime').textContent =
      toMinutes(Service.settings.option('calltime'));
    document.getElementById('smscount').textContent =
      Service.settings.option('smscount');
  }

  // Attach listener to keep the UI updated
  function _configureTelephonyView() {
    Service.settings.observe('calltime', _setTelephonyView);
    Service.settings.observe('smscount', _setTelephonyView);
    document.getElementById('reset-telephony').addEventListener('click',
      function ccapp_resetTelephony() {
        _showResetConfirmation(Service.resetTelephonyCounters);
      }
    );
  }

  function _configureUI() {
    _configureGUIWidgets();
    _configureBalanceView();
    _configureTelephonyView();
  }

  // Adapt the layout depending plantype
  function _changeLayout(planType) {
    function setSectionVisibility(sectionId, visibility) {
      var header, entries;
      header = document.getElementById(sectionId);
      entries = document.querySelector('#' + sectionId + ' + ul');
      header.setAttribute('aria-hidden', !visibility + '');
      entries.setAttribute('aria-hidden', !visibility + '');
    }

    function moveResetEntriesTo(sectionId) {
      var entries = document.querySelectorAll('.reset-entry');
      var ul = document.querySelector('#' + sectionId + ' + ul');
      [].forEach.call(entries, function ccapp_appendResetEntry(entry) {
        ul.appendChild(entry);
      });
    }

    if (planType === Service.PLAN_PREPAID) {
      setSectionVisibility('phone-activity-settings', false);
      setSectionVisibility('balance-settings', true);
      setSectionVisibility('data-usage-settings', true);
      setSectionVisibility('phone-internet-settings', false);
      moveResetEntriesTo('data-usage-settings');

    } else if (planType === Service.PLAN_POSTPAID) {
      setSectionVisibility('phone-activity-settings', true);
      setSectionVisibility('balance-settings', false);
      setSectionVisibility('data-usage-settings', false);
      setSectionVisibility('phone-internet-settings', true);
      moveResetEntriesTo('phone-internet-settings');
    }
  }

  // Configure each settings' control and paint the interface
  function _init() {
    _configureUI();

    // Change layout depending on plantype
    Service.settings.observe('plantype', _changeLayout);

    // Close settings
    var close = document.getElementById('close-settings');
    close.addEventListener('click', function ccapp_closeSettings() {
      parent.settingsVManager.closeCurrentView();
    });

    // Localize interface
    window.addEventListener('localized', _localize);
  }

  // Repaint settings interface reading from local settings and localizing
  function _updateUI() {
    _setBalanceView();
    _setTelephonyView();
  }

  // Updates the UI to match the localization
  function _localize() {
    _updateUI();
  }

  _init();

}

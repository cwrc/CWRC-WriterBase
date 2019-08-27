let jQuery = require('jquery');
window.$ = window.jQuery = jQuery;
global.$ = global.jQuery = jQuery;

// need to explicity load jquery-ui
require('jquery-ui/ui/version');
require('jquery-ui/ui/plugin');
require('jquery-ui/ui/widget');

require('jquery-ui/ui/data');
require('jquery-ui/ui/disable-selection');
require('jquery-ui/ui/escape-selector');
require('jquery-ui/ui/focusable');
require('jquery-ui/ui/form');
require('jquery-ui/ui/form-reset-mixin');
require('jquery-ui/ui/keycode');
require('jquery-ui/ui/labels');
require('jquery-ui/ui/position');
require('jquery-ui/ui/safe-active-element');
require('jquery-ui/ui/safe-blur');
require('jquery-ui/ui/scroll-parent');
require('jquery-ui/ui/tabbable');
require('jquery-ui/ui/unique-id');

require('jquery-ui/ui/widgets/mouse');

require('jquery-ui/ui/widgets/accordion');
require('jquery-ui/ui/widgets/button');
require('jquery-ui/ui/widgets/checkboxradio');
require('jquery-ui/ui/widgets/controlgroup');
require('jquery-ui/ui/widgets/datepicker');
require('jquery-ui/ui/widgets/dialog');
require('jquery-ui/ui/widgets/draggable');
require('jquery-ui/ui/widgets/droppable');
require('jquery-ui/ui/widgets/menu');
require('jquery-ui/ui/widgets/progressbar');
require('jquery-ui/ui/widgets/resizable');
require('jquery-ui/ui/widgets/selectable');
require('jquery-ui/ui/widgets/selectmenu');
require('jquery-ui/ui/widgets/tabs');
require('jquery-ui/ui/widgets/tooltip');

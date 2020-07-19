var $ = require('jquery');

var moment = require('moment/moment');
moment.suppressDeprecationWarnings = true;

var DialogForm = require('../../../dialogs/dialogForm/dialogForm'); 

require('jquery-ui/ui/widgets/datepicker');
require('jquery-ui/ui/widgets/button');

module.exports = function(writer, parentEl) {
    
    var w = writer;
    var today = new Date();
    var upperLimit = today.getFullYear() + 10;
    
    var id = w.getUniqueId('dateForm_');
    var $el = $(''+
    '<div class="annotationDialog">'+
        '<div id="'+id+'_type" data-transform="buttonset">'+
            '<p>Date type:</p>'+
            '<input type="radio" name="dateType" value="date" id="'+id+'_type_date" checked="checked"/><label for="'+id+'_type_date">Single Date</label>'+
            '<input type="radio" name="dateType" value="range" id="'+id+'_type_range"/><label for="'+id+'_type_range">Date Range</label>'+
        '</div>'+
        '<div id="'+id+'_date">'+
            '<label for="'+id+'_cwrc_datePicker">Date:</label><br/><input type="text" data-type="textbox" data-mapping="when" id="'+id+'_cwrc_datePicker" />'+
        '</div>'+
        '<div id="'+id+'_range">'+
            '<label for="'+id+'_startDate">Start date:</label><br/><input type="text" data-type="textbox" data-mapping="from" id="'+id+'_startDate" style="margin-bottom: 5px;"/><br />'+
            '<label for="'+id+'_endDate">End date:</label><br/><input type="text" data-type="textbox" data-mapping="to" id="'+id+'_endDate" />'+
        '</div>'+
        '<div>Format: YYYY, YYYY-MM, or YYYY-MM-DD<br/>e.g. 2010, 2010-10, 2010-10-31</div>'+
        '<div id="'+id+'_certainty" data-transform="buttonset" data-type="radio" data-mapping="cert">'+
            '<p>This identification is:</p>'+
            '<input type="radio" id="'+id+'_high" name="'+id+'_id_certainty" value="high" data-default="true" /><label for="'+id+'_high">High</label>'+
            '<input type="radio" id="'+id+'_medium" name="'+id+'_id_certainty" value="medium" /><label for="'+id+'_medium">Medium</label>'+
            '<input type="radio" id="'+id+'_low" name="'+id+'_id_certainty" value="low" /><label for="'+id+'_low">Low</label>'+
            '<input type="radio" id="'+id+'_unknown" name="'+id+'_id_certainty" value="unknown" /><label for="'+id+'_unknown">Unknown</label>'+
        '</div>'+
        '<div data-transform="accordion">'+
            '<h3>Markup options</h3>'+
            '<div id="'+id+'_attParent" class="attributes" data-type="attributes" data-mapping="attributes">'+
            '</div>'+
        '</div>'+
    '</div>').appendTo(parentEl);
    
    var dialog = new DialogForm({
        writer: w,
        $el: $el,
        type: 'date',
        title: 'Tag Date'
    });
    
    $('#'+id+'_type input').click(function() {
        toggleDate($(this).val());
    });
    
    var $dateInput = $('#'+id+'_cwrc_datePicker');
    $dateInput.focus(function() {
        $(this).css({borderBottom: ''});
    });
    
    $dateInput.datepicker({
        dateFormat: 'yy-mm-dd',
        constrainInput: false,
        changeMonth: true,
        changeYear: true,
        yearRange: '-210:+10',
        minDate: new Date(1800, 0, 1),
        maxDate: new Date(upperLimit, 11, 31),
        showOn: 'button',
        buttonText: 'Date Picker',
        buttonImage: w.cwrcRootUrl+'img/calendar.png',
        buttonImageOnly: true
    });
    // TODO find a better way to do this
    $('#ui-datepicker-div').appendTo(parentEl);
    
    var $startDate = $('#'+id+'_startDate');
    $startDate.focus(function() {
        $(this).css({borderBottom: ''});
    });
    var $endDate = $('#'+id+'_endDate');
    $endDate.focus(function() {
        $(this).css({borderBottom: ''});
    });
    
    
    var dateRange = $('#'+id+'_startDate, #'+id+'_endDate').datepicker({
        dateFormat: 'yy-mm-dd',
        constrainInput: false,
        changeMonth: true,
        changeYear: true,
        yearRange: '-210:+10',
        minDate: new Date(1800, 0, 1),
        maxDate: new Date(upperLimit, 11, 31),
        showOn: 'button',
        buttonText: 'Date Picker',
        buttonImage:  w.cwrcRootUrl+'img/calendar.png',
        buttonImageOnly: true,
        onSelect: function(selectedDate) {
            var option = this.id.indexOf("startDate") === -1 ? "maxDate" : "minDate";
            var instance = $(this).data("datepicker");
            var date = $.datepicker.parseDate(instance.settings.dateFormat || $.datepicker._defaults.dateFormat, selectedDate, instance.settings);
            dateRange.not(this).datepicker("option", option, date);
        }
    });
    
    var toggleDate = function(type) {
        $dateInput.val('');
        $startDate.val('');
        $endDate.val('');
        if (type == 'date') {
            $('#'+id+'_date').show();
            $('#'+id+'_range').hide();
        } else {
            $('#'+id+'_date').hide();
            $('#'+id+'_range').show();
        }
    };
    
    dialog.$el.on('beforeShow', function(e, config) {
        dateRange.datepicker('option', 'minDate', new Date(1800, 0, 1));
        dateRange.datepicker('option', 'maxDate', new Date(upperLimit, 11, 31));
        if (dialog.mode === DialogForm.ADD) {
            var dateValue = '';
            
            var dateString = w.editor.currentBookmark.rng.toString();
            if (dateString != '') {
                var dateMoment = moment(dateString);
                if (dateMoment.isValid()) {
                    var dateObj = dateMoment.toDate(); // use moment library to parse date string properly
                    var year = dateObj.getFullYear();
                    if (dateString.length > 4) {
                        var month = dateObj.getMonth();
                        month++; // month is zero based index
                        if (month < 10) month = '0'+month;
                        var day = dateObj.getDate();
                        if (day < 10) day = '0'+day;
                        dateValue = year+'-'+month+'-'+day;
                    } else {
                        year++; // if just the year, Date makes it dec 31st at midnight of the prior year
                        dateValue = year;
                    }
                }
            }

            toggleDate('date');
            $('#'+id+'_type_date').prop('checked', true);
            $dateInput.val(dateValue);
            $startDate.val('');
            $endDate.val('');
        } else {
            var data = config.entry.getAttributes();
            if (data.when !== undefined) {
                toggleDate('date');
                $('#'+id+'_type_date').prop('checked', true);
                $dateInput.val(data.when);
                $startDate.val('');
                $endDate.val('');
            } else {
                toggleDate('range');
                $('#'+id+'_type_range').prop('checked', true);
                $dateInput.val('');
                $startDate.val(data.from);
                $endDate.val(data.to);
            }
        }
        
        $('#'+id+'_type input').button('refresh');
        
        $dateInput.css({borderBottom: ''});
        $startDate.css({borderBottom: ''});
        $endDate.css({borderBottom: ''});
        $dateInput.focus();
    });
    
    dialog.$el.on('beforeSave', function(e, dialog) {
        var error = false;
        var type = $('#'+id+'_type input:checked').val();
        if (type === 'date') {
            var dateString = $dateInput.val();
            var dateMoment = moment(dateString);
            if (dateMoment.isValid()) {
                dialog.currentData.attributes.when = dateString;
            } else {
                $dateInput.css({borderBottom: '1px solid red'});
                error = true;
            }
        } else {
            var startString = $startDate.val();
            var endString = $endDate.val();
            var startMoment = moment(startString);
            var endMoment = moment(endString);
            
            if (startMoment.isValid()) {
                dialog.currentData.attributes.from = startString;
            } else {
                $startDate.css({borderBottom: '1px solid red'});
                error = true;
            }
            
            if (endMoment.isValid()) {
                dialog.currentData.attributes.to = endString;
            } else {
                $endDate.css({borderBottom: '1px solid red'});
                error = true;
            }
            
            if (startMoment.isAfter(endMoment)) {
                $startDate.css({borderBottom: '1px solid red'});
                $endDate.css({borderBottom: '1px solid red'});
                error = true;
            }
        }
        
        if (error) {
            dialog.isValid = false;
        } else {
            dialog.isValid = true;
        }
    });
    
    return {
        show: function(config) {
            dialog.show(config);
        },
        destroy: function() {
            $dateInput.datepicker('destroy');
            dateRange.datepicker('destroy');
            dialog.destroy();
        }
    };
};

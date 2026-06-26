// ========================================================================
// [CUSTOM] Problem Task Expiring and Expired Notifications
// Description: Scheduled job to monitor Problem Tasks due dates and trigger 
// notifications (Email and Teams) based on custom business rules.
// ========================================================================
 
(function executeScheduledJob() {
 
    // REPLACE WITH YOUR SCHEDULE SYS_ID
    var SCHEDULE_ID = "00000000000000000000000000000000"; 
    
    var todayValue = new GlideDateTime().getDate().getValue(); // yyyy-MM-dd
    var instanceName = gs.getProperty("instance_name");
     
    var gr_problem_task = new GlideRecord("problem_task");
    // Filter active problem tasks with a due date
    gr_problem_task.addEncodedQuery("problem.stateIN103,104,106^state!=157^due_dateISNOTEMPTY");
    gr_problem_task.query();
     
    while (gr_problem_task.next()) {
     
        var sendNotification = false;
        var startExpiredFlow = false;
         
        var dueDateTimeValue = gr_problem_task.getValue("due_date");
        if (gs.nil(dueDateTimeValue)) {
            gs.info(" No notification -> " + gr_problem_task.getDisplayValue("number") + " | reason: due_date is empty");
            continue;
        }
         
        var dueDateValue = getDateOnlyValue(dueDateTimeValue); // yyyy-MM-dd
        var daysExpired = getDaysBetweenDates(dueDateValue, todayValue);
         
        // =========================
        // EXPIRED TASKS
        // =========================
        if (daysExpired > 0) {
            // Triggers every 15 days after expiration
            if (((daysExpired - 1) % 15) === 0) {
                startExpiredFlow = true;
                sendNotification = true;
            }
         
        // =========================
        // EXPIRING TASKS
        // =========================
        } else {
            var dueDate_oneBusinessBefore = getPreviousBusinessDateValue(dueDateTimeValue, SCHEDULE_ID);
            var dueDate_fifteenBefore = addDaysToDateValue(dueDateValue, -15);
             
            if (dueDate_oneBusinessBefore && normalizeDate(dueDate_oneBusinessBefore) === normalizeDate(todayValue)) {
                sendNotification = true;
            } else if (normalizeDate(dueDate_fifteenBefore) === normalizeDate(todayValue)) {
                sendNotification = true;
            }
        }
         
        // =========================
        // SEND NOTIFICATION
        // =========================
        if (!sendNotification) {
            gs.info(" No notification -> " + gr_problem_task.getDisplayValue("number"));
            continue;
        }
         
        var assignedTo = gr_problem_task.assigned_to.getRefRecord();
        if (!assignedTo || !assignedTo.isValidRecord()) {
            gs.warn(" Notification not sent -> " + gr_problem_task.getDisplayValue("number") + " | reason: assigned_to is empty or invalid");
            continue;
        }
         
        var userEmail = assignedTo.getValue("email");
        if (gs.nil(userEmail)) {
            gs.warn(" Notification not sent -> " + gr_problem_task.getDisplayValue("number") + " | reason: user has no email");
            continue;
        }
         
        var userLanguage = assignedTo.getValue("preferred_language") || "en";
        var sessionLang = gs.getSession().getLanguage();
         
        try {
            gs.getSession().setLanguage(userLanguage);
             
            var prb = gr_problem_task.problem.getRefRecord();
             
            var json = {};
            json.email = userEmail;
            json.fullname = assignedTo.getDisplayValue();
            json.userid = assignedTo.getValue("user_name");
            json.locale = isPortuguese(userLanguage) ? "pt" : "en";
             
            // REPLACE WITH YOUR ACTUAL INTEGRATION HASHES
            json.hashProduct = startExpiredFlow ? "DUMMY-HASH-EXPIRED-FLOW-0001" : "DUMMY-HASH-EXPIRING-FLOW-0002";
             
            json.searchUserIAM = "false";
            json.factSet = "";
             
            json.field1 = gr_problem_task.getDisplayValue("number") + " - " + gr_problem_task.getDisplayValue("short_description");
            json.field2 = (prb && prb.isValidRecord()) ? prb.getValue("number") + " - " + prb.getValue("short_description") : "";
            json.field3 = (prb && prb.isValidRecord()) ? prb.getDisplayValue("priority") : "";
            json.field4 = (prb && prb.isValidRecord()) ? prb.getDisplayValue("assignment_group") : "";
            json.field5 = gr_problem_task.getDisplayValue("due_date");
            json.field6 = (prb && prb.isValidRecord()) ? prb.getDisplayValue("assigned_to") : "";
            json.field7 = getProblemStateLabel(prb, userLanguage);
            
            // Note: Replace 'u_custom_reason' with your specific custom field or remove if not needed
            json.field8 = (prb && prb.isValidRecord()) ? prb.getDisplayValue("u_custom_reason") : "";
            json.field9 = "https://" + instanceName + ".service-now.com/problem_task.do?sys_id=" + gr_problem_task.getUniqueValue();
            json.comments = json.field9;
             
            // Trigger Events - Ensure these are registered in your instance
            if (startExpiredFlow) {
                gs.eventQueue("custom.problem.taskexpired.notification", gr_problem_task, userEmail);
            } else {
                gs.eventQueue("custom.problem.taskexpiring.notification", gr_problem_task, userEmail);
            }
             
            gs.eventQueue("custom.problem.notificationTEAMS", gr_problem_task, JSON.stringify(json));
             
            gs.info(" Notification triggered -> " +
            gr_problem_task.getDisplayValue("number") +
            (startExpiredFlow ? " [EXPIRED]" : " [EXPIRING]") +
            " | due_date: " + gr_problem_task.getDisplayValue("due_date") +
            " | today: " + todayValue +
            " | daysExpired: " + daysExpired);
             
        } finally {
            gs.getSession().setLanguage(sessionLang);
        }
    }
     
})();
     
// =========================
// HELPER FUNCTIONS
// =========================
 
function getDateOnlyValue(dateTimeValue) {
    var gdt = new GlideDateTime(dateTimeValue);
    return gdt.getDate().getValue(); // yyyy-MM-dd
}
 
function addDaysToDateValue(dateValue, days) {
    var gdt = new GlideDateTime(dateValue + " 12:00:00");
    gdt.addDaysLocalTime(days);
    return gdt.getDate().getValue(); // yyyy-MM-dd
}
 
function getPreviousBusinessDateValue(dueDateTimeValue, scheduleId) {
    if (gs.nil(dueDateTimeValue)) {
        return null;
    }
     
    var schedule = new GlideSchedule(scheduleId);
    var candidate = new GlideDateTime(dueDateTimeValue);
    candidate.addDaysLocalTime(-1);
     
    var maxIterations = 30;
     
    for (var i = 0; i < maxIterations; i++) {
        // Uses noon to validate "business day" to avoid edge cases around midnight
        var probe = new GlideDateTime(candidate.getDate().getValue() + " 12:00:00");
         
        if (schedule.isInSchedule(probe)) {
            return candidate.getDate().getValue(); // yyyy-MM-dd
        }
         
        candidate.addDaysLocalTime(-1);
    }
     
    gs.warn(" getPreviousBusinessDateValue -> Could not find a valid business day for due_date: " + dueDateTimeValue);
    return null;
}
 
function getDaysBetweenDates(startDateValue, endDateValue) {
    if (gs.nil(startDateValue) || gs.nil(endDateValue)) {
        return 0;
    }
     
    var start = startDateValue + " 00:00:00";
    var end = endDateValue + " 00:00:00";
     
    return Math.floor(gs.dateDiff(start, end, true) / 86400);
}
 
function getProblemStateLabel(problemRecord, userLang) {
    if (!problemRecord || !problemRecord.isValidRecord()) {
        return "";
    }
     
    var state = problemRecord.getValue("state");
    var language = userLang || "en";
     
    var gr = new GlideRecord("sys_choice");
    gr.addQuery("name", "problem");
    gr.addQuery("element", "state");
    gr.addQuery("inactive", false);
    gr.addQuery("language", language);
    gr.addQuery("value", state);
    gr.query();
     
    if (gr.next()) {
        return gr.getValue("label");
    }
     
    return problemRecord.getDisplayValue("state");
}
 
function isPortuguese(language) {
    language = (language || "").toLowerCase();
    return language.indexOf("pb") === 0 || language.indexOf("pt") === 0;
}
 
function normalizeDate(dateValue) {
    if (gs.nil(dateValue)) {
        return "";
    }
     
    var gdt = new GlideDateTime(dateValue + " 12:00:00");
    return gdt.getDate().getValue();
}

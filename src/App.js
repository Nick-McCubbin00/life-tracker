import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, X, Trash2, Database, Info, ListTodo, CalendarDays, Flame, ShoppingCart, Star, Target } from 'lucide-react';
import { db } from './firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

// Helper to format date to 'YYYY-MM-DD'
const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    // Adjust for timezone offset to prevent date shifts
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Main App Component
export default function App() {
    // State management
    const [activeTab, setActiveTab] = useState('calendar');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [reminderDays, setReminderDays] = useState(30);
    const [inputDate, setInputDate] = useState('');
    const [category, setCategory] = useState('');
    const [reminders, setReminders] = useState([]);
    const [error, setError] = useState('');
    const [selectedDayStr, setSelectedDayStr] = useState(null);
    // weekly upcoming removed
    const [remoteError, setRemoteError] = useState('');
    const [usingRemote, setUsingRemote] = useState(false);
    // simplified colors: blue/green/red only
    const [infoMessage, setInfoMessage] = useState('');
    const infoTimerRef = useRef(null);
    const [editingNotesId, setEditingNotesId] = useState(null);
    const [noteDraft, setNoteDraft] = useState('');

    // Extended entities
    const [tasks, setTasks] = useState([]);
    const [habits, setHabits] = useState([]);
    const [groceries, setGroceries] = useState([]);
    const [requests, setRequests] = useState([]);

    // Inputs
    const [taskTitle, setTaskTitle] = useState('');
    const [taskFrequency, setTaskFrequency] = useState('daily');
    const [taskDueDate, setTaskDueDate] = useState('');

    const [habitName, setHabitName] = useState('');
    const [habitCadence, setHabitCadence] = useState('daily');

    const [groceryName, setGroceryName] = useState('');
    const [groceryQty, setGroceryQty] = useState('');
    const [groceryCategory, setGroceryCategory] = useState('');

    const [requestTitle, setRequestTitle] = useState('');
    const [requestPriority, setRequestPriority] = useState('medium');
    const [requestDue, setRequestDue] = useState('');
    const [requestDetails, setRequestDetails] = useState('');

    // Backup/Restore in-progress state
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // Load reminders from Firestore if configured, else fallback to localStorage
    useEffect(() => {
        // settings fallback
        try {
            const savedDays = localStorage.getItem('reminderDays');
            if (savedDays) {
                const n = parseInt(savedDays, 10);
                if (!Number.isNaN(n) && n > 0) setReminderDays(n);
            }
        } catch (_) {}

        if (db) {
            setUsingRemote(true);
            const unsubs = [];
            // Reminders
            unsubs.push(onSnapshot(
                collection(db, 'reminders'),
                (snap) => {
                    const rows = [];
                    snap.forEach((d) => rows.push(d.data()));
                    setReminders(rows);
                    try { localStorage.setItem('reminders', JSON.stringify(rows)); } catch (_) {}
                },
                (err) => setRemoteError(err?.message || 'Sync error')
            ));
            // Tasks
            unsubs.push(onSnapshot(
                collection(db, 'tasks'),
                (snap) => {
                    const rows = [];
                    snap.forEach((d) => rows.push(d.data()));
                    setTasks(rows);
                    try { localStorage.setItem('tasks', JSON.stringify(rows)); } catch (_) {}
                },
                (err) => setRemoteError(err?.message || 'Sync error')
            ));
            // Habits
            unsubs.push(onSnapshot(
                collection(db, 'habits'),
                (snap) => {
                    const rows = [];
                    snap.forEach((d) => rows.push(d.data()));
                    setHabits(rows);
                    try { localStorage.setItem('habits', JSON.stringify(rows)); } catch (_) {}
                },
                (err) => setRemoteError(err?.message || 'Sync error')
            ));
            // Groceries
            unsubs.push(onSnapshot(
                collection(db, 'groceries'),
                (snap) => {
                    const rows = [];
                    snap.forEach((d) => rows.push(d.data()));
                    setGroceries(rows);
                    try { localStorage.setItem('groceries', JSON.stringify(rows)); } catch (_) {}
                },
                (err) => setRemoteError(err?.message || 'Sync error')
            ));
            // Requests
            unsubs.push(onSnapshot(
                collection(db, 'requests'),
                (snap) => {
                    const rows = [];
                    snap.forEach((d) => rows.push(d.data()));
                    setRequests(rows);
                    try { localStorage.setItem('requests', JSON.stringify(rows)); } catch (_) {}
                },
                (err) => setRemoteError(err?.message || 'Sync error')
            ));

            return () => unsubs.forEach((u) => { try { u(); } catch (_) {} });
        } else {
            try {
                const savedReminders = localStorage.getItem('reminders');
                if (savedReminders) {
                    const parsed = JSON.parse(savedReminders);
                    if (Array.isArray(parsed)) setReminders(parsed);
                }
            } catch (_) {}
            try {
                const savedTasks = localStorage.getItem('tasks');
                if (savedTasks) {
                    const parsed = JSON.parse(savedTasks);
                    if (Array.isArray(parsed)) setTasks(parsed);
                }
            } catch (_) {}
            try {
                const savedHabits = localStorage.getItem('habits');
                if (savedHabits) {
                    const parsed = JSON.parse(savedHabits);
                    if (Array.isArray(parsed)) setHabits(parsed);
                }
            } catch (_) {}
            try {
                const savedGroceries = localStorage.getItem('groceries');
                if (savedGroceries) {
                    const parsed = JSON.parse(savedGroceries);
                    if (Array.isArray(parsed)) setGroceries(parsed);
                }
            } catch (_) {}
            try {
                const savedRequests = localStorage.getItem('requests');
                if (savedRequests) {
                    const parsed = JSON.parse(savedRequests);
                    if (Array.isArray(parsed)) setRequests(parsed);
                }
            } catch (_) {}
        }
    }, []);

    // Persist reminders to localStorage as cache for offline/fallback
    useEffect(() => {
        try { localStorage.setItem('reminders', JSON.stringify(reminders)); } catch (_) {}
    }, [reminders]);

    // Persist reminderDays setting
    useEffect(() => {
        try {
            localStorage.setItem('reminderDays', String(reminderDays));
        } catch (_) {}
    }, [reminderDays]);

    // Persist other collections
    useEffect(() => { try { localStorage.setItem('tasks', JSON.stringify(tasks)); } catch (_) {} }, [tasks]);
    useEffect(() => { try { localStorage.setItem('habits', JSON.stringify(habits)); } catch (_) {} }, [habits]);
    useEffect(() => { try { localStorage.setItem('groceries', JSON.stringify(groceries)); } catch (_) {} }, [groceries]);
    useEffect(() => { try { localStorage.setItem('requests', JSON.stringify(requests)); } catch (_) {} }, [requests]);

    // Prefill the add-item form with the selected day when opening the day modal
    useEffect(() => {
        if (selectedDayStr) setInputDate(selectedDayStr);
    }, [selectedDayStr]);

    // Memoized values for calendar generation to prevent recalculation on every render
    const { month, year, daysInMonth, firstDayOfMonth } = useMemo(() => {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        return { month, year, daysInMonth, firstDayOfMonth };
    }, [currentDate]);

    // Handlers for month navigation
    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const handleSetReminder = () => {
        if (!inputDate || !reminderDays || !category) {
            setError('Please fill in all fields: date, reminder days, and category.');
            return;
        }
        if (reminderDays <= 0) {
            setError('Reminder days must be a positive number.');
            return;
        }
        setError('');

        const planned = new Date(inputDate);
        const days = parseInt(reminderDays, 10);

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newReminder = {
            id,
            category: category.trim(),
            reminderDays: days,
            plannedDate: planned.toISOString(),
            lastUpdated: null,
            nextUpdate: null,
            // keep a backlog of previous update dates (rendered as blue)
            history: [],
            dataPulled: false,
            notes: '',
            createdAt: serverTimestamp ? serverTimestamp() : null,
        };
        setReminders((prev) => [...prev, newReminder]);
        if (db) {
            setDoc(doc(collection(db, 'reminders'), id), newReminder).catch((e) => setRemoteError(e?.message || 'Failed to save to server'));
        }
        setCategory('');
        setInputDate('');
    };

    const handleCompleteReminder = (reminderId, completedDate) => {
        setReminders((prev) => prev.map((r) => {
            if (r.id !== reminderId) return r;

            // Preserve previous lastUpdated in backlog history
            const backlog = Array.isArray(r.history) ? [...r.history] : [];
            if (r.lastUpdated) backlog.push(r.lastUpdated);

            const newLastUpdated = new Date(completedDate);
            const newNext = new Date(newLastUpdated);
            newNext.setDate(newNext.getDate() + r.reminderDays);
            // After finishing (green), next cycle becomes planned (blue)
            const updated = { ...r, plannedDate: newNext.toISOString(), lastUpdated: newLastUpdated.toISOString(), nextUpdate: newNext.toISOString(), history: backlog };
            if (db) {
                updateDoc(doc(collection(db, 'reminders'), r.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update on server'));
            }
            return updated;
        }));
    };

    // Manual status controls
    const setStatusBlue = (reminderId, targetDate) => {
        setReminders((prev) => prev.map((r) => {
            if (r.id !== reminderId) return r;
            const updated = {
                ...r,
                plannedDate: new Date(targetDate).toISOString(),
                // if we are reverting the same-day green, clear it
                lastUpdated: (formatDate(r.lastUpdated) === formatDate(targetDate)) ? null : r.lastUpdated,
                nextUpdate: null,
            };
            if (db) updateDoc(doc(collection(db, 'reminders'), r.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update on server'));
            return updated;
        }));
    };

    const setStatusGreen = (reminderId, targetDate) => {
        handleCompleteReminder(reminderId, targetDate);
    };

    // Removed explicit Red status

    const toggleDataPulled = (reminderId) => {
        setReminders((prev) => prev.map((r) => {
            if (r.id !== reminderId) return r;
            const updated = { ...r, dataPulled: !r.dataPulled };
            if (db) updateDoc(doc(collection(db, 'reminders'), r.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update on server'));
            return updated;
        }));
    };

    const handleDeleteReminder = (reminderId) => {
        setReminders((prev) => prev.filter((r) => r.id !== reminderId));
        if (db) deleteDoc(doc(collection(db, 'reminders'), reminderId)).catch((e) => setRemoteError(e?.message || 'Failed to delete on server'));
    };

    const handleDeleteHistoryDate = (reminderId, historyIsoString) => {
        setReminders((prev) => prev.map((r) => {
            if (r.id !== reminderId) return r;
            const newHistory = (Array.isArray(r.history) ? r.history : []).filter((h) => h !== historyIsoString);
            const updated = { ...r, history: newHistory };
            if (db) updateDoc(doc(collection(db, 'reminders'), r.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update on server'));
            return updated;
        }));
    };

    const showReminderInfo = (reminder) => {
        const days = reminder?.reminderDays;
        let nextDate = null;
        if (reminder?.nextUpdate) nextDate = new Date(reminder.nextUpdate);
        else if (reminder?.lastUpdated) { const d = new Date(reminder.lastUpdated); d.setDate(d.getDate() + (reminder.reminderDays || 0)); nextDate = d; }
        else if (reminder?.plannedDate) { const d = new Date(reminder.plannedDate); d.setDate(d.getDate() + (reminder.reminderDays || 0)); nextDate = d; }
        const nextStr = nextDate ? ` | Next: ${nextDate.toLocaleDateString()}` : '';
        const msg = days ? `"${reminder.category}" reminds every ${days} day${days === 1 ? '' : 's'}${nextStr}` : 'No reminder interval set';
        setInfoMessage(msg);
        if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
        infoTimerRef.current = setTimeout(() => setInfoMessage(''), 2500);
    };

    const startEditNotes = (reminder) => {
        setEditingNotesId(reminder.id);
        setNoteDraft(reminder.notes || '');
    };

    const saveNotes = (reminderId) => {
        const trimmed = noteDraft.trim();
        setReminders((prev) => prev.map((r) => {
            if (r.id !== reminderId) return r;
            const updated = { ...r, notes: trimmed };
            if (db) updateDoc(doc(collection(db, 'reminders'), r.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update on server'));
            return updated;
        }));
        setEditingNotesId(null);
        setNoteDraft('');
    };

    const cancelNotes = () => {
        setEditingNotesId(null);
        setNoteDraft('');
    };

    // no range-based color mapping

    // Utilities
    const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const startOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.getFullYear(), d.getMonth(), diff);
    };
    const endOfWeek = (date) => {
        const s = startOfWeek(date);
        return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
    };
    const isDateInWeek = (iso, refDate) => {
        if (!iso) return false;
        const d = new Date(iso);
        const s = startOfWeek(refDate);
        const e = endOfWeek(refDate);
        return d >= s && d <= e;
    };

    // Tasks
    const handleAddTask = () => {
        const title = taskTitle.trim();
        if (!title) return;
        const id = generateId();
        const payload = {
            id,
            title,
            frequency: taskFrequency,
            dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : null,
            checklist: [],
            completedDates: [],
            notes: '',
            createdAt: serverTimestamp ? serverTimestamp() : null,
        };
        setTasks((prev) => [...prev, payload]);
        if (db) setDoc(doc(collection(db, 'tasks'), id), payload).catch((e) => setRemoteError(e?.message || 'Failed to save task'));
        setTaskTitle('');
        setTaskDueDate('');
        setTaskFrequency('daily');
    };
    const toggleTaskDoneToday = (taskId) => {
        const todayStr = formatDate(new Date());
        setTasks((prev) => prev.map((t) => {
            if (t.id !== taskId) return t;
            const done = Array.isArray(t.completedDates) && t.completedDates.includes(todayStr);
            const updated = { ...t, completedDates: done ? t.completedDates.filter((d) => d !== todayStr) : [...(t.completedDates || []), todayStr] };
            if (db) updateDoc(doc(collection(db, 'tasks'), t.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update task'));
            return updated;
        }));
    };
    const deleteTask = (taskId) => {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        if (db) deleteDoc(doc(collection(db, 'tasks'), taskId)).catch((e) => setRemoteError(e?.message || 'Failed to delete task'));
    };
    const addChecklistItem = (taskId, text) => {
        const trimmed = (text || '').trim();
        if (!trimmed) return;
        setTasks((prev) => prev.map((t) => {
            if (t.id !== taskId) return t;
            const newItem = { id: generateId(), text: trimmed, done: false };
            const updated = { ...t, checklist: [...(t.checklist || []), newItem] };
            if (db) updateDoc(doc(collection(db, 'tasks'), t.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update task'));
            return updated;
        }));
    };
    const toggleChecklistItem = (taskId, itemId) => {
        setTasks((prev) => prev.map((t) => {
            if (t.id !== taskId) return t;
            const updated = { ...t, checklist: (t.checklist || []).map((i) => i.id === itemId ? { ...i, done: !i.done } : i) };
            if (db) updateDoc(doc(collection(db, 'tasks'), t.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update task'));
            return updated;
        }));
    };
    const removeChecklistItem = (taskId, itemId) => {
        setTasks((prev) => prev.map((t) => {
            if (t.id !== taskId) return t;
            const updated = { ...t, checklist: (t.checklist || []).filter((i) => i.id !== itemId) };
            if (db) updateDoc(doc(collection(db, 'tasks'), t.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update task'));
            return updated;
        }));
    };

    // Habits
    const handleAddHabit = () => {
        const name = habitName.trim();
        if (!name) return;
        const id = generateId();
        const payload = { id, name, cadence: habitCadence, log: {}, createdAt: serverTimestamp ? serverTimestamp() : null };
        setHabits((prev) => [...prev, payload]);
        if (db) setDoc(doc(collection(db, 'habits'), id), payload).catch((e) => setRemoteError(e?.message || 'Failed to save habit'));
        setHabitName('');
        setHabitCadence('daily');
    };
    const toggleHabitToday = (habitId) => {
        const todayStr = formatDate(new Date());
        setHabits((prev) => prev.map((h) => {
            if (h.id !== habitId) return h;
            const newLog = { ...(h.log || {}) };
            if (newLog[todayStr]) delete newLog[todayStr]; else newLog[todayStr] = true;
            const updated = { ...h, log: newLog };
            if (db) updateDoc(doc(collection(db, 'habits'), h.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update habit'));
            return updated;
        }));
    };
    const deleteHabit = (habitId) => {
        setHabits((prev) => prev.filter((h) => h.id !== habitId));
        if (db) deleteDoc(doc(collection(db, 'habits'), habitId)).catch((e) => setRemoteError(e?.message || 'Failed to delete habit'));
    };

    // Groceries
    const handleAddGrocery = () => {
        const name = groceryName.trim();
        if (!name) return;
        const id = generateId();
        const payload = { id, name, quantity: groceryQty.trim() || '1', category: groceryCategory.trim() || '', checked: false, createdAt: serverTimestamp ? serverTimestamp() : null };
        setGroceries((prev) => [...prev, payload]);
        if (db) setDoc(doc(collection(db, 'groceries'), id), payload).catch((e) => setRemoteError(e?.message || 'Failed to save grocery'));
        setGroceryName('');
        setGroceryQty('');
        setGroceryCategory('');
    };
    const toggleGrocery = (groceryId) => {
        setGroceries((prev) => prev.map((g) => {
            if (g.id !== groceryId) return g;
            const updated = { ...g, checked: !g.checked };
            if (db) updateDoc(doc(collection(db, 'groceries'), g.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to update grocery'));
            return updated;
        }));
    };
    const clearCheckedGroceries = () => {
        const remaining = groceries.filter((g) => !g.checked);
        setGroceries(remaining);
        if (db) {
            const removed = groceries.filter((g) => g.checked);
            removed.forEach((g) => deleteDoc(doc(collection(db, 'groceries'), g.id)).catch(() => {}));
        }
    };
    const deleteGrocery = (groceryId) => {
        setGroceries((prev) => prev.filter((g) => g.id !== groceryId));
        if (db) deleteDoc(doc(collection(db, 'groceries'), groceryId)).catch((e) => setRemoteError(e?.message || 'Failed to delete grocery'));
    };

    // Requests
    const handleAddRequest = () => {
        const title = requestTitle.trim();
        if (!title) return;
        const id = generateId();
        const payload = {
            id,
            title,
            details: requestDetails.trim(),
            priority: requestPriority,
            requestedDueDate: requestDue ? new Date(requestDue).toISOString() : null,
            approved: false,
            approvedDueDate: null,
            status: 'pending',
            createdAt: serverTimestamp ? serverTimestamp() : null,
        };
        setRequests((prev) => [...prev, payload]);
        if (db) setDoc(doc(collection(db, 'requests'), id), payload).catch((e) => setRemoteError(e?.message || 'Failed to save request'));
        setRequestTitle('');
        setRequestDetails('');
        setRequestDue('');
        setRequestPriority('medium');
    };
    const approveRequest = (requestId, newDueDateStr) => {
        setRequests((prev) => prev.map((r) => {
            if (r.id !== requestId) return r;
            const updated = { ...r, approved: true, status: 'approved', approvedDueDate: newDueDateStr ? new Date(newDueDateStr).toISOString() : (r.requestedDueDate || null) };
            if (db) updateDoc(doc(collection(db, 'requests'), r.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to approve request'));
            return updated;
        }));
    };
    const completeRequest = (requestId) => {
        setRequests((prev) => prev.map((r) => {
            if (r.id !== requestId) return r;
            const updated = { ...r, status: 'completed' };
            if (db) updateDoc(doc(collection(db, 'requests'), r.id), updated).catch((e) => setRemoteError(e?.message || 'Failed to complete request'));
            return updated;
        }));
    };
    const deleteRequest = (requestId) => {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        if (db) deleteDoc(doc(collection(db, 'requests'), requestId)).catch((e) => setRemoteError(e?.message || 'Failed to delete request'));
    };

    // Calendar rendering logic
    const renderCalendar = () => {
        const calendarDays = [];
        const today = new Date();
        const todayStr = formatDate(today);

        // Add blank cells for days before the 1st of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarDays.push(<div key={`empty-start-${i}`} className="border-r border-b border-gray-200"></div>);
        }

        // Add cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day);
            const dayStr = formatDate(dayDate);

            let dayClasses = "relative p-2 h-36 text-xs border-r border-b border-gray-200 flex flex-col justify-start items-start transition-colors duration-200 overflow-hidden";
            if (dayStr === todayStr) dayClasses += " bg-blue-50";

            const updatedToday = reminders.filter(r => formatDate(r.lastUpdated) === dayStr);
            const dueToday = reminders.filter(r => formatDate(r.nextUpdate) === dayStr);
            const scheduledToday = reminders.filter(r => (!r.lastUpdated && formatDate(r.plannedDate) === dayStr));

            const updatedTodayFiltered = updatedToday;
            const toDoTodayMap = new Map();
            scheduledToday.forEach((r) => toDoTodayMap.set(r.id, r));
            dueToday.forEach((r) => toDoTodayMap.set(r.id, r));
            const toDoToday = Array.from(toDoTodayMap.values());
            

            calendarDays.push(
                <div
                    key={dayStr}
                    className={dayClasses + " cursor-pointer hover:bg-gray-50"}
                    onClick={() => setSelectedDayStr(dayStr)}
                >
                    <span className="font-medium text-gray-700">{day}</span>
                    <div className="mt-1 w-full space-y-1">
                        {updatedTodayFiltered.map((r) => (
                            <div
                                key={`u-${r.id}`}
                                className="w-full text-[10px] text-white bg-green-500 rounded-lg shadow px-1.5 py-0.5 truncate"
                                title={`'${r.category}' done on ${new Date(r.lastUpdated).toLocaleDateString()}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium truncate flex items-center gap-1">
                                        {r.category}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {r.dataPulled && <Database size={12} />}
                                        <button className="p-0.5 rounded hover:bg-white/10" onClick={(e) => { e.stopPropagation(); showReminderInfo(r); }} title="Show reminder interval">
                                            <Info size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {toDoToday.map((r) => (
                            <button
                                key={`s-${r.id}`}
                                onClick={(e) => { e.stopPropagation(); handleCompleteReminder(r.id, dayDate); }}
                                className={`w-full text-[10px] text-white rounded-lg shadow px-1.5 py-0.5 truncate transition-colors bg-blue-500 hover:bg-blue-400`}
                                title={`'${r.category}' scheduled on ${new Date(r.plannedDate).toLocaleDateString()} (click to mark done)`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium truncate flex items-center gap-1">
                                        {r.category}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {r.dataPulled && <Database size={12} />}
                                        <button className="p-0.5 rounded hover:bg-white/10" onClick={(e) => { e.stopPropagation(); showReminderInfo(r); }} title="Show reminder interval">
                                            <Info size={12} />
                                        </button>
                                    </div>
                                </div>
                            </button>
                        ))}
                        
                        {/* Red/due state removed */}
                    </div>
                </div>
            );
        }
        
        // Fill remaining grid cells
        const totalCells = 42; // 6 weeks * 7 days
        while(calendarDays.length % 7 !== 0 || calendarDays.length < totalCells) {
            calendarDays.push(<div key={`empty-end-${calendarDays.length}`} className="border-r border-b border-gray-200"></div>);
        }

        return calendarDays;
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // 'today' computed inline in calendar rendering

    return (
        <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-7xl mx-auto space-y-4">

                {/* Tabs */}
                <div className="bg-white p-2 rounded-2xl shadow border border-gray-200">
                    <div className="flex flex-wrap gap-2 items-center">
                        <button onClick={() => setActiveTab('calendar')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='calendar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><CalendarDays size={16} /> Calendar</button>
                        <button onClick={() => setActiveTab('focus')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='focus' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Target size={16} /> Focus</button>
                        <button onClick={() => setActiveTab('tasks')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='tasks' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><ListTodo size={16} /> Tasks</button>
                        <button onClick={() => setActiveTab('habits')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='habits' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Flame size={16} /> Habits</button>
                        <button onClick={() => setActiveTab('groceries')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='groceries' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><ShoppingCart size={16} /> Groceries</button>
                        <button onClick={() => setActiveTab('requests')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='requests' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Star size={16} /> Requests</button>
                        <div className="ml-auto flex items-center gap-2">
                            {usingRemote ? (
                                <span className="text-xs text-green-700 bg-green-100 border border-green-200 rounded px-2 py-1">Synced</span>
                            ) : (
                                <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-1" title="Falling back to local storage">Offline</span>
                            )}
                            <button
                                disabled={isBackingUp}
                                onClick={async ()=>{
                                    try {
                                        setIsBackingUp(true);
                                        const payload = {
                                            reminders,
                                            tasks,
                                            habits,
                                            groceries,
                                            requests,
                                            exportedAt: new Date().toISOString(),
                                        };
                                        const resp = await fetch('/api/save-backup', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ data: payload })
                                        });
                                        const json = await resp.json();
                                        if (!resp.ok) throw new Error(json?.error || 'Backup failed');
                                        setInfoMessage('Backup saved');
                                    } catch (e) {
                                        setRemoteError(e?.message || 'Backup failed');
                                    } finally {
                                        setIsBackingUp(false);
                                    }
                                }}
                                className={`text-xs rounded px-2 py-1 ${isBackingUp ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} border border-gray-200`}
                            >{isBackingUp ? 'Backing up…' : 'Backup'}</button>
                            <button
                                disabled={isRestoring}
                                onClick={async ()=>{
                                    try {
                                        setIsRestoring(true);
                                        const resp = await fetch('/api/load-backup');
                                        const json = await resp.json();
                                        if (!resp.ok) throw new Error(json?.error || 'Restore failed');
                                        const d = json?.data || {};
                                        if (Array.isArray(d.reminders)) setReminders(d.reminders);
                                        if (Array.isArray(d.tasks)) setTasks(d.tasks);
                                        if (Array.isArray(d.habits)) setHabits(d.habits);
                                        if (Array.isArray(d.groceries)) setGroceries(d.groceries);
                                        if (Array.isArray(d.requests)) setRequests(d.requests);
                                        setInfoMessage('Backup restored');
                                    } catch (e) {
                                        setRemoteError(e?.message || 'Restore failed');
                                    } finally {
                                        setIsRestoring(false);
                                    }
                                }}
                                className={`text-xs rounded px-2 py-1 ${isRestoring ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} border border-gray-200`}
                            >{isRestoring ? 'Restoring…' : 'Restore'}</button>
                        </div>
                    </div>
                </div>

                {/* --- Calendar Display --- */}
                {activeTab === 'calendar' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800">{monthNames[month]} {year}</h3>
                        <div className="flex items-center gap-2">
                            {usingRemote ? (
                                <span className="text-xs text-green-700 bg-green-100 border border-green-200 rounded px-2 py-1">Synced</span>
                            ) : (
                                <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-1" title="Falling back to local storage">Offline</span>
                            )}
                            
                            <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">
                                <ChevronLeft className="text-gray-600" size={20} />
                            </button>
                            <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">
                                <ChevronRight className="text-gray-600" size={20} />
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 text-center font-semibold text-sm text-gray-500">
                        {dayNames.map(day => <div key={day} className="py-2 border-b-2 border-gray-200">{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 grid-rows-6">
                        {renderCalendar()}
                    </div>
                    {remoteError && (
                        <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
                            <AlertTriangle size={14} />
                            <span>{remoteError}</span>
                        </div>
                    )}
                </div>
                )}

                {/* Focus Tab */}
                {activeTab === 'focus' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-6">
                    <div className="text-xl font-bold text-gray-800">Focus</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div className="text-sm font-semibold text-gray-700 mb-2">Today</div>
                            <div className="space-y-2">
                                {tasks.filter((t)=>{
                                    const todayStr = formatDate(new Date());
                                    if (t.frequency==='daily') return true;
                                    if (t.frequency==='oneoff') return formatDate(t.dueDate)===todayStr;
                                    if (t.frequency==='weekly') return isDateInWeek(t.dueDate, new Date()) && new Date(t.dueDate).getDay()===new Date().getDay();
                                    if (t.frequency==='monthly') return new Date(t.dueDate || new Date()).getDate()===new Date().getDate();
                                    return false;
                                }).map((t)=>{
                                    const doneToday = Array.isArray(t.completedDates) && t.completedDates.includes(formatDate(new Date()));
                                    return (
                                        <div key={t.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                            <div>
                                                <div className={`text-sm font-semibold ${doneToday ? 'line-through text-gray-500' : 'text-gray-800'}`}>{t.title}</div>
                                                <div className="text-xs text-gray-500 capitalize">{t.frequency}{t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ''}</div>
                                            </div>
                                            <button className={`text-xs rounded px-2 py-1 ${doneToday ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`} onClick={()=>toggleTaskDoneToday(t.id)}>{doneToday ? 'Done' : 'Mark'}</button>
                                        </div>
                                    )
                                })}
                                {tasks.length===0 && <div className="text-xs text-gray-500">No tasks yet.</div>}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-gray-700 mb-2">This Week</div>
                            <div className="space-y-2">
                                {tasks.filter((t)=>{
                                    if (t.frequency==='daily') return true;
                                    if (t.frequency==='oneoff') return isDateInWeek(t.dueDate, new Date());
                                    if (t.frequency==='weekly') return isDateInWeek(t.dueDate, new Date());
                                    if (t.frequency==='monthly') return new Date(t.dueDate || new Date()).getMonth()===new Date().getMonth();
                                    return false;
                                }).map((t)=> (
                                    <div key={t.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                        <div>
                                            <div className="text-sm font-semibold text-gray-800">{t.title}</div>
                                            <div className="text-xs text-gray-500 capitalize">{t.frequency}{t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ''}</div>
                                        </div>
                                        <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300" onClick={()=>toggleTaskDoneToday(t.id)}>Mark today</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* Tasks Tab */}
                {activeTab === 'tasks' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-6">
                    <div className="text-xl font-bold text-gray-800">Tasks</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input value={taskTitle} onChange={(e)=>setTaskTitle(e.target.value)} placeholder="Task title" className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            <select value={taskFrequency} onChange={(e)=>setTaskFrequency(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="oneoff">One-off</option>
                            </select>
                            <input type="date" value={taskDueDate} onChange={(e)=>setTaskDueDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                            <button onClick={handleAddTask} className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700">Add Task</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {['daily','weekly','monthly'].map((freq)=> (
                            <div key={freq}>
                                <div className="text-sm font-semibold text-gray-700 mb-2 capitalize">{freq}</div>
                                <div className="space-y-2">
                                    {tasks.filter((t)=>t.frequency===freq).map((t)=>{
                                        const doneToday = Array.isArray(t.completedDates) && t.completedDates.includes(formatDate(new Date()));
                                        return (
                                            <div key={t.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className={`text-sm font-semibold ${doneToday ? 'line-through text-gray-500' : 'text-gray-800'}`}>{t.title}</div>
                                                        <div className="text-xs text-gray-500">{t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString()}` : 'No due date'}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button className={`text-xs rounded px-2 py-1 ${doneToday ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`} onClick={()=>toggleTaskDoneToday(t.id)}>{doneToday ? 'Done' : 'Mark today'}</button>
                                                        <button className="text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1 hover:bg-gray-50" onClick={()=>deleteTask(t.id)}><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-600 mb-1">Checklist</div>
                                                    <div className="space-y-1">
                                                        {(t.checklist || []).map((i)=> (
                                                            <label key={i.id} className="flex items-center gap-2 text-xs">
                                                                <input type="checkbox" checked={!!i.done} onChange={()=>toggleChecklistItem(t.id, i.id)} />
                                                                <span className={i.done ? 'line-through text-gray-500' : ''}>{i.text}</span>
                                                                <button className="ml-auto text-gray-500 hover:text-gray-800" onClick={()=>removeChecklistItem(t.id, i.id)}><Trash2 size={12}/></button>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <AddChecklistInline onAdd={(text)=>addChecklistItem(t.id, text)} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {tasks.filter((t)=>t.frequency===freq).length===0 && (
                                        <div className="text-xs text-gray-500">No {freq} tasks.</div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div>
                            <div className="text-sm font-semibold text-gray-700 mb-2">One-off</div>
                            <div className="space-y-2">
                                {tasks.filter((t)=>t.frequency==='oneoff').map((t)=> (
                                    <div key={t.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-gray-800">{t.title}</div>
                                                <div className="text-xs text-gray-500">{t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString()}` : 'No due date'}</div>
                                            </div>
                                            <button className="text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1 hover:bg-gray-50" onClick={()=>deleteTask(t.id)}><Trash2 size={14}/></button>
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-gray-600 mb-1">Checklist</div>
                                            <div className="space-y-1">
                                                {(t.checklist || []).map((i)=> (
                                                    <label key={i.id} className="flex items-center gap-2 text-xs">
                                                        <input type="checkbox" checked={!!i.done} onChange={()=>toggleChecklistItem(t.id, i.id)} />
                                                        <span className={i.done ? 'line-through text-gray-500' : ''}>{i.text}</span>
                                                        <button className="ml-auto text-gray-500 hover:text-gray-800" onClick={()=>removeChecklistItem(t.id, i.id)}><Trash2 size={12}/></button>
                                                    </label>
                                                ))}
                                            </div>
                                            <AddChecklistInline onAdd={(text)=>addChecklistItem(t.id, text)} />
                                        </div>
                                    </div>
                                ))}
                                {tasks.filter((t)=>t.frequency==='oneoff').length===0 && (
                                    <div className="text-xs text-gray-500">No one-off tasks.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* Habits Tab */}
                {activeTab === 'habits' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-6">
                    <div className="text-xl font-bold text-gray-800">Habits</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input value={habitName} onChange={(e)=>setHabitName(e.target.value)} placeholder="Habit name" className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            <select value={habitCadence} onChange={(e)=>setHabitCadence(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                            <div className="md:col-span-1" />
                            <button onClick={handleAddHabit} className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700">Add Habit</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {habits.map((h)=>{
                            const todayStr = formatDate(new Date());
                            const checked = !!(h.log || {})[todayStr];
                            return (
                                <div key={h.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <div>
                                        <div className="text-sm font-semibold text-gray-800">{h.name}</div>
                                        <div className="text-xs text-gray-500 capitalize">{h.cadence}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className={`text-xs rounded px-2 py-1 ${checked ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`} onClick={()=>toggleHabitToday(h.id)}>{checked ? 'Done today' : 'Mark today'}</button>
                                        <button className="text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1 hover:bg-gray-50" onClick={()=>deleteHabit(h.id)}><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            )
                        })}
                        {habits.length===0 && <div className="text-xs text-gray-500">No habits yet.</div>}
                    </div>
                </div>
                )}

                {/* Groceries Tab */}
                {activeTab === 'groceries' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-6">
                    <div className="text-xl font-bold text-gray-800">Groceries</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                            <input value={groceryName} onChange={(e)=>setGroceryName(e.target.value)} placeholder="Item" className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            <input value={groceryQty} onChange={(e)=>setGroceryQty(e.target.value)} placeholder="Qty" className="px-3 py-2 border border-gray-300 rounded-lg" />
                            <input value={groceryCategory} onChange={(e)=>setGroceryCategory(e.target.value)} placeholder="Category" className="px-3 py-2 border border-gray-300 rounded-lg" />
                            <div className="md:col-span-1" />
                            <button onClick={handleAddGrocery} className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700">Add Item</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {groceries.map((g)=> (
                            <label key={g.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                <input type="checkbox" checked={!!g.checked} onChange={()=>toggleGrocery(g.id)} />
                                <div>
                                    <div className={`text-sm font-semibold ${g.checked ? 'line-through text-gray-500' : 'text-gray-800'}`}>{g.name} {g.quantity ? `· ${g.quantity}` : ''}</div>
                                    <div className="text-xs text-gray-500">{g.category}</div>
                                </div>
                                <button className="ml-auto text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1 hover:bg-gray-50" onClick={()=>deleteGrocery(g.id)}><Trash2 size={14}/></button>
                            </label>
                        ))}
                        {groceries.length===0 && <div className="text-xs text-gray-500">No items yet.</div>}
                        {groceries.some((g)=>g.checked) && (
                            <div className="pt-2">
                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300" onClick={clearCheckedGroceries}>Clear checked</button>
                            </div>
                        )}
                    </div>
                </div>
                )}

                {/* Requests Tab */}
                {activeTab === 'requests' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-6">
                    <div className="text-xl font-bold text-gray-800">Fiancé Requests</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                            <input value={requestTitle} onChange={(e)=>setRequestTitle(e.target.value)} placeholder="Title" className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            <select value={requestPriority} onChange={(e)=>setRequestPriority(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                            <input type="date" value={requestDue} onChange={(e)=>setRequestDue(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                            <input value={requestDetails} onChange={(e)=>setRequestDetails(e.target.value)} placeholder="Details" className="px-3 py-2 border border-gray-300 rounded-lg md:col-span-2" />
                            <button onClick={handleAddRequest} className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700">Add</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {['pending','approved','completed'].map((status)=> (
                            <div key={status}>
                                <div className="text-sm font-semibold text-gray-700 mb-2 capitalize">{status}</div>
                                <div className="space-y-2">
                                    {requests.filter((r)=>r.status===status).sort((a,b)=>{
                                        const pri = { high: 0, medium: 1, low: 2 };
                                        return pri[a.priority]-pri[b.priority];
                                    }).map((r)=> (
                                        <div key={r.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-800">{r.title}</div>
                                                    <div className="text-xs text-gray-500">Priority: <span className="capitalize">{r.priority}</span>{r.requestedDueDate ? ` · requested ${new Date(r.requestedDueDate).toLocaleDateString()}` : ''}{r.approvedDueDate ? ` · due ${new Date(r.approvedDueDate).toLocaleDateString()}` : ''}</div>
                                                </div>
                                                <button className="text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1 hover:bg-gray-50" onClick={()=>deleteRequest(r.id)}><Trash2 size={14}/></button>
                                            </div>
                                            {status==='pending' && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <input type="date" defaultValue={r.requestedDueDate ? formatDate(r.requestedDueDate) : ''} onChange={(e)=>approveRequest(r.id, e.target.value)} className="px-2 py-1 border border-gray-300 rounded" />
                                                    <button className="text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700" onClick={()=>approveRequest(r.id, r.requestedDueDate ? formatDate(r.requestedDueDate) : '')}>Approve</button>
                                                </div>
                                            )}
                                            {status==='approved' && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <button className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700" onClick={()=>completeRequest(r.id)}>Mark done</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {requests.filter((r)=>r.status===status).length===0 && (
                                        <div className="text-xs text-gray-500">No {status} items.</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                )}
            </div>

            {/* Weekly Upcoming panel removed */}

            {/* Floating info toast */}
            {infoMessage && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg">
                    {infoMessage}
                </div>
            )}

            {/* --- Day Details Modal --- */}
            {selectedDayStr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4" onClick={() => setSelectedDayStr(null)}>
                    <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h4 className="text-lg font-bold text-gray-800">Details for {new Date(selectedDayStr).toLocaleDateString()}</h4>
                            <button className="p-2 rounded hover:bg-gray-100" onClick={() => setSelectedDayStr(null)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Add Item Category */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="text-sm font-semibold text-gray-700 mb-2">Add Item Category</div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Category"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                    />
                                    <input
                                        type="date"
                                        value={inputDate}
                                        onChange={(e) => setInputDate(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        value={reminderDays}
                                        onChange={(e) => setReminderDays(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        placeholder="Days"
                                    />
                                </div>
                                {error && (
                                    <div className="mt-2 flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded">
                                        <AlertTriangle size={16} />
                                        <p className="text-xs font-medium">{error}</p>
                                    </div>
                                )}
                                <div className="mt-2 flex justify-end">
                                    <button
                                        onClick={handleSetReminder}
                                        className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                            {/* Scheduled (Blue planned) */}
                            <div>
                                <div className="text-sm font-semibold text-gray-700 mb-2">Scheduled</div>
                                {reminders.filter((r) => !r.lastUpdated && formatDate(r.plannedDate) === selectedDayStr).length === 0 ? (
                                    <p className="text-xs text-gray-500">No scheduled items this day.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {reminders.filter((r) => !r.lastUpdated && formatDate(r.plannedDate) === selectedDayStr).map((r) => (
                                            <div key={`dlg-s-${r.id}`} className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                                                            {r.category}
                                                            {r.dataPulled && <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-100 border border-purple-200 rounded px-1 py-0.5"><Database size={12} /> Data</span>}
                                                        </div>
                                                        <div className="text-xs text-blue-600">Scheduled on {new Date(r.plannedDate).toLocaleDateString()}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300" onClick={() => setStatusBlue(r.id, new Date(selectedDayStr))}>Blue</button>
                                                        <button className="text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700" onClick={() => setStatusGreen(r.id, new Date(selectedDayStr))}>Green</button>
                                                        
                                                        <button className="text-xs bg-purple-600 text-white rounded px-2 py-1 hover:bg-purple-700" onClick={() => toggleDataPulled(r.id)}>Data</button>
                                                        <button className="text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1 hover:bg-gray-50" onClick={() => startEditNotes(r)}>Notes</button>
                                                    </div>
                                                </div>
                                                {editingNotesId === r.id ? (
                                                    <div className="mt-2">
                                                        <textarea rows={3} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} className="w-full text-xs border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Add notes..." />
                                                        <div className="mt-2 flex gap-2 justify-end">
                                                            <button className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700" onClick={() => saveNotes(r.id)}>Save</button>
                                                            <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300" onClick={cancelNotes}>Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    r.notes ? <div className="mt-2 text-xs text-gray-700 whitespace-pre-wrap">{r.notes}</div> : null
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Updated Today (Green) */}
                            <div>
                                <div className="text-sm font-semibold text-gray-700 mb-2">Done</div>
                                {reminders.filter((r) => formatDate(r.lastUpdated) === selectedDayStr).length === 0 ? (
                                    <p className="text-xs text-gray-500">No items updated this day.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {reminders.filter((r) => formatDate(r.lastUpdated) === selectedDayStr).map((r) => (
                                            <div key={`dlg-u-${r.id}`} className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="text-sm font-semibold text-green-700 flex items-center gap-2">
                                                            {r.category}
                                                            {r.dataPulled && <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-100 border border-purple-200 rounded px-1 py-0.5"><Database size={12} /> Data</span>}
                                                        </div>
                                                        <div className="text-xs text-green-600">Updated on {new Date(r.lastUpdated).toLocaleDateString()}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300" onClick={() => setStatusBlue(r.id, new Date(selectedDayStr))}>Blue</button>
                                                        <button className="text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700" onClick={() => setStatusGreen(r.id, new Date(selectedDayStr))}>Green</button>
                                                        
                                                        <button className="text-xs bg-purple-600 text-white rounded px-2 py-1 hover:bg-purple-700" onClick={() => toggleDataPulled(r.id)}>Data</button>
                                                        <button className="text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1 hover:bg-gray-50" onClick={() => startEditNotes(r)}>Notes</button>
                                                        <button
                                                            className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300"
                                                            title="Delete item"
                                                            onClick={() => handleDeleteReminder(r.id)}
                                                        >
                                                            <Trash2 size={14} /> Delete
                                                        </button>
                                                    </div>
                                                </div>
                                                {editingNotesId === r.id ? (
                                                    <div className="mt-2">
                                                        <textarea rows={3} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} className="w-full text-xs border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Add notes..." />
                                                        <div className="mt-2 flex gap-2 justify-end">
                                                            <button className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700" onClick={() => saveNotes(r.id)}>Save</button>
                                                            <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300" onClick={cancelNotes}>Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    r.notes ? <div className="mt-2 text-xs text-gray-700 whitespace-pre-wrap">{r.notes}</div> : null
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Due section removed */}

                            {/* Backlog History (Blue) */}
                            <div>
                                <div className="text-sm font-semibold text-gray-700 mb-2">Backlog</div>
                                {(() => {
                                    const histRows = [];
                                    reminders.forEach((r) => {
                                        const hist = Array.isArray(r.history) ? r.history : [];
                                        hist.forEach((h, idx) => {
                                            if (formatDate(h) === selectedDayStr && formatDate(r.lastUpdated) !== selectedDayStr) {
                                                histRows.push({ reminder: r, date: h, key: `dlg-h-${r.id}-${idx}` });
                                            }
                                        });
                                    });
                                    if (histRows.length === 0) {
                                        return <p className="text-xs text-gray-500">No backlog entries this day.</p>;
                                    }
                                    return (
                                        <div className="space-y-2">
                                            {histRows.map(({ reminder: r, date, key }) => (
                                                <div key={key} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                                    <div>
                                                        <div className="text-sm font-semibold text-blue-700">{r.category}</div>
                                                        <div className="text-xs text-blue-600">Previously updated on {new Date(date).toLocaleDateString()}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300"
                                                            title="Remove this backlog date"
                                                            onClick={() => handleDeleteHistoryDate(r.id, date)}
                                                        >
                                                            <Trash2 size={14} /> Delete date
                                                        </button>
                                                        <button
                                                            className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300"
                                                            title="Delete item"
                                                            onClick={() => handleDeleteReminder(r.id)}
                                                        >
                                                            <Trash2 size={14} /> Delete item
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Inline subcomponent for adding checklist items
function AddChecklistInline({ onAdd }) {
    const [text, setText] = React.useState('');
    const handleAdd = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        onAdd(trimmed);
        setText('');
    };
    return (
        <div className="mt-2 flex items-center gap-2">
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add checklist item"
                className="flex-1 px-2 py-1 border border-gray-300 rounded"
            />
            <button
                className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300"
                onClick={handleAdd}
            >
                Add
            </button>
        </div>
    );
}

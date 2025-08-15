import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, X, Trash2, Database, Info } from 'lucide-react';
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
            const unsub = onSnapshot(
                collection(db, 'reminders'),
                (snap) => {
                    const rows = [];
                    snap.forEach((d) => rows.push(d.data()));
                    setReminders(rows);
                    try { localStorage.setItem('reminders', JSON.stringify(rows)); } catch (_) {}
                },
                (err) => {
                    setRemoteError(err?.message || 'Sync error');
                }
            );
            return () => unsub();
        } else {
            try {
                const savedReminders = localStorage.getItem('reminders');
                if (savedReminders) {
                    const parsed = JSON.parse(savedReminders);
                    if (Array.isArray(parsed)) setReminders(parsed);
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
            const updated = { ...r, plannedDate: newNext.toISOString(), lastUpdated: newLastUpdated.toISOString(), nextUpdate: null, history: backlog };
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
            const historyToday = [];
            reminders.forEach((r) => {
                const hist = Array.isArray(r.history) ? r.history : [];
                hist.forEach((h, idx) => {
                    if (formatDate(h) === dayStr && formatDate(r.lastUpdated) !== dayStr) {
                        historyToday.push({ key: `h-${r.id}-${idx}`, category: r.category, date: h, isWeekly: r.reminderDays === 7 });
                    }
                });
            });

            const updatedTodayFiltered = updatedToday;
            const dueTodayFiltered = dueToday;
            const scheduledTodayFiltered = scheduledToday;
            const historyTodayFiltered = historyToday;

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
                                title={`'${r.category}' updated on ${new Date(r.lastUpdated).toLocaleDateString()}`}
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
                        {scheduledTodayFiltered.map((r) => (
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
                        {historyTodayFiltered.map((h) => (
                            <div
                                key={h.key}
                                className="w-full text-[10px] text-white bg-blue-500 rounded-lg shadow px-1.5 py-0.5 truncate"
                                title={`'${h.category}' previously updated on ${new Date(h.date).toLocaleDateString()}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium truncate flex items-center gap-1">
                                        {h.category}
                                    </span>
                                </div>
                            </div>
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

                {/* --- Calendar Display --- */}
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
                                <div className="text-sm font-semibold text-gray-700 mb-2">Updated</div>
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

                            {/* Due Today (Red) */}
                            <div>
                                <div className="text-sm font-semibold text-gray-700 mb-2">Due</div>
                                {reminders.filter((r) => formatDate(r.nextUpdate) === selectedDayStr).length === 0 ? (
                                    <p className="text-xs text-gray-500">No reminders due this day.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {reminders.filter((r) => formatDate(r.nextUpdate) === selectedDayStr).map((r) => (
                                            <div key={`dlg-d-${r.id}`} className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="text-sm font-semibold text-red-700 flex items-center gap-2">
                                                            {r.category}
                                                            {r.dataPulled && <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-100 border border-purple-200 rounded px-1 py-0.5"><Database size={12} /> Data</span>}
                                                        </div>
                                                        <div className="text-xs text-red-600">Due on {new Date(r.nextUpdate).toLocaleDateString()}</div>
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

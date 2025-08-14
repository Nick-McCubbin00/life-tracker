import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle, X, Trash2, Check } from 'lucide-react';
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
    const [showWeeklyUpcoming, setShowWeeklyUpcoming] = useState(false);

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
            const unsub = onSnapshot(collection(db, 'reminders'), (snap) => {
                const rows = [];
                snap.forEach((d) => rows.push(d.data()));
                setReminders(rows);
                try { localStorage.setItem('reminders', JSON.stringify(rows)); } catch (_) {}
            });
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

        const lastUpdatedDate = new Date(inputDate);
        const days = parseInt(reminderDays, 10);
        const nextUpdateDate = new Date(lastUpdatedDate);
        nextUpdateDate.setDate(nextUpdateDate.getDate() + days);

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newReminder = {
            id,
            category: category.trim(),
            reminderDays: days,
            lastUpdated: lastUpdatedDate.toISOString(),
            nextUpdate: nextUpdateDate.toISOString(),
            // keep a backlog of previous update dates (rendered as blue)
            history: [],
            createdAt: serverTimestamp ? serverTimestamp() : null,
        };
        setReminders((prev) => [...prev, newReminder]);
        if (db) {
            setDoc(doc(collection(db, 'reminders'), id), newReminder).catch(() => {});
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
            const updated = { ...r, lastUpdated: newLastUpdated.toISOString(), nextUpdate: newNext.toISOString(), history: backlog };
            if (db) {
                updateDoc(doc(collection(db, 'reminders'), r.id), updated).catch(() => {});
            }
            return updated;
        }));
    };

    const handleDeleteReminder = (reminderId) => {
        setReminders((prev) => prev.filter((r) => r.id !== reminderId));
        if (db) deleteDoc(doc(collection(db, 'reminders'), reminderId)).catch(() => {});
    };

    const handleDeleteHistoryDate = (reminderId, historyIsoString) => {
        setReminders((prev) => prev.map((r) => {
            if (r.id !== reminderId) return r;
            const newHistory = (Array.isArray(r.history) ? r.history : []).filter((h) => h !== historyIsoString);
            const updated = { ...r, history: newHistory };
            if (db) updateDoc(doc(collection(db, 'reminders'), r.id), updated).catch(() => {});
            return updated;
        }));
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

            let dayClasses = "relative p-2 h-24 text-sm border-r border-b border-gray-200 flex flex-col justify-start items-start transition-colors duration-200 overflow-hidden";
            if (dayStr === todayStr) dayClasses += " bg-blue-50";

            const updatedToday = reminders.filter(r => formatDate(r.lastUpdated) === dayStr);
            const dueToday = reminders.filter(r => formatDate(r.nextUpdate) === dayStr);
            const historyToday = [];
            reminders.forEach((r) => {
                const hist = Array.isArray(r.history) ? r.history : [];
                hist.forEach((h, idx) => {
                    if (formatDate(h) === dayStr && formatDate(r.lastUpdated) !== dayStr) {
                        historyToday.push({ key: `h-${r.id}-${idx}`, category: r.category, date: h });
                    }
                });
            });

            calendarDays.push(
                <div
                    key={dayStr}
                    className={dayClasses + " cursor-pointer hover:bg-gray-50"}
                    onClick={() => setSelectedDayStr(dayStr)}
                >
                    <span className="font-medium text-gray-700">{day}</span>
                    <div className="mt-1 w-full space-y-1">
                        {updatedToday.map((r) => (
                            <div
                                key={`u-${r.id}`}
                                className="w-full text-xs text-white bg-green-500 rounded-lg shadow-md px-2 py-1 truncate"
                                title={`'${r.category}' updated on ${new Date(r.lastUpdated).toLocaleDateString()}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium truncate">{r.category}</span>
                                </div>
                            </div>
                        ))}
                        {historyToday.map((h) => (
                            <div
                                key={h.key}
                                className="w-full text-xs text-white bg-blue-500 rounded-lg shadow-md px-2 py-1 truncate"
                                title={`'${h.category}' previously updated on ${new Date(h.date).toLocaleDateString()}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium truncate">{h.category}</span>
                                </div>
                            </div>
                        ))}
                        {dueToday.map((r) => (
                            <button
                                key={`d-${r.id}`}
                                onClick={(e) => { e.stopPropagation(); handleCompleteReminder(r.id, dayDate); }}
                                className="w-full text-xs text-white bg-red-500 rounded-lg shadow-md px-2 py-1 truncate hover:bg-red-200 hover:text-red-600 transition-colors"
                                title={`'${r.category}' due on ${new Date(r.nextUpdate).toLocaleDateString()} (click to complete)`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium truncate">{r.category}</span>
                                </div>
                            </button>
                        ))}
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

    // Weekly upcoming breakdown (current week Sun-Sat)
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartMs = weekStart.getTime();
    const weekEndMs = weekEnd.getTime();
    const weeklyUpcoming = useMemo(() => {
        return reminders
            .filter((r) => {
                const nextMs = new Date(r.nextUpdate).getTime();
                return nextMs >= weekStartMs && nextMs <= weekEndMs;
            })
            .sort((a, b) => new Date(a.nextUpdate) - new Date(b.nextUpdate));
    }, [reminders, weekStartMs, weekEndMs]);

    return (
        <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-6xl mx-auto space-y-4">
                {/* Top Toolbar */}
                <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow border border-gray-200">
                    <div className="flex items-center gap-2 text-gray-700">
                        <CalendarIcon size={18} />
                        <span className="font-semibold">Calendar</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowWeeklyUpcoming((v) => !v)}
                            className="inline-flex items-center gap-2 bg-purple-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-purple-700"
                        >
                            This Week's Upcoming
                            <span className="inline-flex items-center justify-center text-xs bg-white/20 rounded px-2 py-0.5">
                                {weeklyUpcoming.length}
                            </span>
                        </button>
                    </div>
                </div>

                {/* --- Calendar Display --- */}
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800">{monthNames[month]} {year}</h3>
                        <div className="flex items-center gap-2">
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
                </div>
            </div>

            {/* Floating Weekly Upcoming Panel */}
            {showWeeklyUpcoming && (
                <div className="fixed right-4 top-20 z-40 w-80 max-w-[90vw] bg-white p-4 rounded-2xl shadow-2xl border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-bold text-gray-800">This Week's Upcoming</h2>
                        <button className="p-2 rounded hover:bg-gray-100" onClick={() => setShowWeeklyUpcoming(false)} aria-label="Close upcoming">
                            <X size={18} />
                        </button>
                    </div>
                    <p className="text-gray-600 mb-3 text-sm">Due between {weekStart.toLocaleDateString()} and {weekEnd.toLocaleDateString()}.</p>
                    {weeklyUpcoming.length === 0 ? (
                        <p className="text-sm text-gray-500">No reminders due this week.</p>
                    ) : (
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                            {weeklyUpcoming.map((r) => (
                                <div key={`wk-${r.id}`} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-red-700 truncate">{r.category}</div>
                                        <div className="text-xs text-red-600">Due {new Date(r.nextUpdate).toLocaleDateString()}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="inline-flex items-center gap-1 text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700"
                                            title="Mark complete today"
                                            onClick={() => handleCompleteReminder(r.id, new Date())}
                                        >
                                            <Check size={14} />
                                        </button>
                                        <button
                                            className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300"
                                            title="Delete item"
                                            onClick={() => handleDeleteReminder(r.id)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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
                            {/* Updated Today (Green) */}
                            <div>
                                <div className="text-sm font-semibold text-gray-700 mb-2">Updated</div>
                                {reminders.filter((r) => formatDate(r.lastUpdated) === selectedDayStr).length === 0 ? (
                                    <p className="text-xs text-gray-500">No items updated this day.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {reminders.filter((r) => formatDate(r.lastUpdated) === selectedDayStr).map((r) => (
                                            <div key={`dlg-u-${r.id}`} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                                <div>
                                                    <div className="text-sm font-semibold text-green-700">{r.category}</div>
                                                    <div className="text-xs text-green-600">Updated on {new Date(r.lastUpdated).toLocaleDateString()}</div>
                                                </div>
                                                <button
                                                    className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300"
                                                    title="Delete item"
                                                    onClick={() => handleDeleteReminder(r.id)}
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>
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
                                            <div key={`dlg-d-${r.id}`} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                                <div>
                                                    <div className="text-sm font-semibold text-red-700">{r.category}</div>
                                                    <div className="text-xs text-red-600">Due on {new Date(r.nextUpdate).toLocaleDateString()}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        className="inline-flex items-center gap-1 text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700"
                                                        title="Mark complete for this day"
                                                        onClick={() => handleCompleteReminder(r.id, new Date(selectedDayStr))}
                                                    >
                                                        <Check size={14} /> Complete
                                                    </button>
                                                    <button
                                                        className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300"
                                                        title="Delete item"
                                                        onClick={() => handleDeleteReminder(r.id)}
                                                    >
                                                        <Trash2 size={14} /> Delete
                                                    </button>
                                                </div>
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

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';

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

    // Load persisted reminders and settings on first mount
    useEffect(() => {
        try {
            const savedReminders = localStorage.getItem('reminders');
            if (savedReminders) {
                const parsed = JSON.parse(savedReminders);
                if (Array.isArray(parsed)) setReminders(parsed);
            }
        } catch (_) {}

        try {
            const savedDays = localStorage.getItem('reminderDays');
            if (savedDays) {
                const n = parseInt(savedDays, 10);
                if (!Number.isNaN(n) && n > 0) setReminderDays(n);
            }
        } catch (_) {}
    }, []);

    // Persist reminders whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('reminders', JSON.stringify(reminders));
        } catch (_) {}
    }, [reminders]);

    // Persist reminderDays setting
    useEffect(() => {
        try {
            localStorage.setItem('reminderDays', String(reminderDays));
        } catch (_) {}
    }, [reminderDays]);

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

        const newReminder = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            category: category.trim(),
            reminderDays: days,
            lastUpdated: lastUpdatedDate.toISOString(),
            nextUpdate: nextUpdateDate.toISOString(),
        };
        setReminders((prev) => [...prev, newReminder]);
        setCategory('');
        setInputDate('');
    };

    const handleCompleteReminder = (reminderId, completedDate) => {
        setReminders((prev) => prev.map((r) => {
            if (r.id !== reminderId) return r;
            const newLastUpdated = new Date(completedDate);
            const newNext = new Date(newLastUpdated);
            newNext.setDate(newNext.getDate() + r.reminderDays);
            return { ...r, lastUpdated: newLastUpdated.toISOString(), nextUpdate: newNext.toISOString() };
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

            calendarDays.push(
                <div key={dayStr} className={dayClasses}>
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
                        {dueToday.map((r) => (
                            <button
                                key={`d-${r.id}`}
                                onClick={() => handleCompleteReminder(r.id, dayDate)}
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

    return (
        <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
                
                {/* --- Control Panel --- */}
                <div className="lg:w-1/3 bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                    <div className="flex items-center gap-3 mb-6">
                         <div className="bg-blue-600 p-2 rounded-lg">
                            <CalendarIcon className="text-white" size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Update Reminder</h2>
                    </div>
                    <p className="text-gray-600 mb-6">Set a date when an item category was last updated and get a reminder for the next update.</p>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="item-category" className="block text-sm font-semibold text-gray-700 mb-1">Item Category</label>
                            <input
                                type="text"
                                id="item-category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="e.g., Marketing Assets"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            />
                        </div>
                        <div>
                            <label htmlFor="last-updated-date" className="block text-sm font-semibold text-gray-700 mb-1">Last Updated Date</label>
                            <input
                                type="date"
                                id="last-updated-date"
                                value={inputDate}
                                onChange={(e) => setInputDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            />
                        </div>
                        <div>
                            <label htmlFor="reminder-days" className="block text-sm font-semibold text-gray-700 mb-1">Remind Me After (Days)</label>
                            <input
                                type="number"
                                id="reminder-days"
                                value={reminderDays}
                                onChange={(e) => setReminderDays(e.target.value)}
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            />
                        </div>
                    </div>
                    
                    {error && (
                        <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                            <AlertTriangle size={20} />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <button
                        onClick={handleSetReminder}
                        className="w-full mt-6 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-300 transform hover:scale-105"
                    >
                        Set Reminder
                    </button>
                </div>

                {/* --- Calendar Display --- */}
                <div className="lg:w-2/3 bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
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
        </div>
    );
}

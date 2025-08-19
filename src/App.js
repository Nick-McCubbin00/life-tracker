import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, X, Trash2, CalendarDays, ShoppingCart, Star, Briefcase, Clipboard } from 'lucide-react';

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
    const [selectedDayStr, setSelectedDayStr] = useState(null);
    const [remoteError, setRemoteError] = useState('');
    const [usingBlob, setUsingBlob] = useState(true);
    const [infoMessage, setInfoMessage] = useState('');
    const infoTimerRef = useRef(null);

    // Collections
    const [tasks, setTasks] = useState([]);      // {id, title, date(YYYY-MM-DD), done, recurrence}
    const [events, setEvents] = useState([]);    // {id, title, date(YYYY-MM-DD)}
    const [groceries, setGroceries] = useState([]); // {id, name, quantity, checked}
    const [requests, setRequests] = useState([]);   // {id, title, details, priority, requestedDueDate, approved, approvedDueDate, status}

    // Inputs (day modal)
    const [newItemType, setNewItemType] = useState('task'); // 'task' | 'event'
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newTaskRecurrence, setNewTaskRecurrence] = useState('none'); // none | daily | weekly | biweekly | monthly
    const [newTaskType, setNewTaskType] = useState('personal'); // personal | work
    const [newRequestTitle, setNewRequestTitle] = useState('');
    const [newRequestPriority, setNewRequestPriority] = useState('medium');
    const [requestDetails, setRequestDetails] = useState('');

    // Groceries inputs
    const [groceryName, setGroceryName] = useState('');
    const [groceryQty, setGroceryQty] = useState('');

    // Requests tab inputs
    const [reqFormTitle, setReqFormTitle] = useState('');
    const [reqFormPriority, setReqFormPriority] = useState('medium');
    const [reqFormDueDate, setReqFormDueDate] = useState('');
    const [reqFormDetails, setReqFormDetails] = useState('');

    // Sidebar filter
    const [sidebarRecurrence, setSidebarRecurrence] = useState('daily'); // daily | weekly | biweekly | monthly

    // Inline editing state for modal items
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editTaskTitle, setEditTaskTitle] = useState('');
    const [editTaskNotes, setEditTaskNotes] = useState('');
    const [editingEventId, setEditingEventId] = useState(null);
    const [editEventTitle, setEditEventTitle] = useState('');
    const [editEventNotes, setEditEventNotes] = useState('');

    // Work tab notes modal
    const [workNotesTaskId, setWorkNotesTaskId] = useState(null);
    const [workNotesDraft, setWorkNotesDraft] = useState('');

    // Meals / Meal Planner
    const [meals, setMeals] = useState([]); // {id,title,recipe,link,ingredients:[{id,name,quantity}]}
    const [groceriesSubtab, setGroceriesSubtab] = useState('list'); // list | planner
    // New meal form
    const [mealTitle, setMealTitle] = useState('');
    const [mealRecipe, setMealRecipe] = useState('');
    const [mealLink, setMealLink] = useState('');
    const [mealIngredients, setMealIngredients] = useState([]);
    const [ingName, setIngName] = useState('');
    const [ingQty, setIngQty] = useState('');
    // Planner week and selections
    const [plannerWeekStart, setPlannerWeekStart] = useState(formatDate(new Date()));
    const [plannerSelection, setPlannerSelection] = useState({}); // {0..6: mealId}

    // Backup/Restore in-progress state
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // Load state from Blob first (awaited), prefer freshest between Blob and localStorage using savedAt
    useEffect(() => {
        (async () => {
            const readLocal = () => {
                const out = {};
                try { out.tasks = JSON.parse(localStorage.getItem('tasks')||'null') || undefined; } catch (_) {}
                try { out.groceries = JSON.parse(localStorage.getItem('groceries')||'null') || undefined; } catch (_) {}
                try { out.requests = JSON.parse(localStorage.getItem('requests')||'null') || undefined; } catch (_) {}
                try { out.events = JSON.parse(localStorage.getItem('events')||'null') || undefined; } catch (_) {}
                try { out.meals = JSON.parse(localStorage.getItem('meals')||'null') || undefined; } catch (_) {}
                try { out.savedAt = localStorage.getItem('savedAt') || null; } catch (_) {}
                return out;
            };

            try {
                const resp = await fetch('/api/state');
                if (resp.ok) {
                    const json = await resp.json();
                    const d = json?.data || {};
                    // Enable Blob persistence
                    setUsingBlob(true);

                    const arrays = {
                        events: Array.isArray(d.events) ? d.events : undefined,
                        tasks: Array.isArray(d.tasks) ? d.tasks : undefined,
                        groceries: Array.isArray(d.groceries) ? d.groceries : undefined,
                        requests: Array.isArray(d.requests) ? d.requests : undefined,
                        meals: Array.isArray(d.meals) ? d.meals : undefined,
                    };
                    const hasAnyItems = Object.values(arrays).some((v) => Array.isArray(v) && v.length > 0);
                    const local = readLocal();
                    const blobSavedAt = Date.parse(d?.savedAt || '');
                    const localSavedAt = Date.parse(local?.savedAt || '');
                    const preferLocal = localSavedAt && (!blobSavedAt || localSavedAt > blobSavedAt);

                    if (!hasAnyItems || preferLocal) {
                        if (Array.isArray(local.events)) setEvents(local.events);
                        if (Array.isArray(local.tasks)) setTasks(local.tasks);
                        if (Array.isArray(local.groceries)) setGroceries(local.groceries);
                        if (Array.isArray(local.requests)) setRequests(local.requests);
                        if (Array.isArray(local.meals)) setMeals(local.meals);
                    } else {
                        if (arrays.events) setEvents(arrays.events);
                        if (arrays.tasks) setTasks(arrays.tasks);
                        if (arrays.groceries) setGroceries(arrays.groceries);
                        if (arrays.requests) setRequests(arrays.requests);
                        if (arrays.meals) setMeals(arrays.meals);
                    }
                } else {
                    setUsingBlob(false);
                    const local = readLocal();
                    if (Array.isArray(local.events)) setEvents(local.events);
                    if (Array.isArray(local.tasks)) setTasks(local.tasks);
                    if (Array.isArray(local.groceries)) setGroceries(local.groceries);
                    if (Array.isArray(local.requests)) setRequests(local.requests);
                    if (Array.isArray(local.meals)) setMeals(local.meals);
                }
            } catch (_) {
                setUsingBlob(false);
                const local = readLocal();
                if (Array.isArray(local.events)) setEvents(local.events);
                if (Array.isArray(local.tasks)) setTasks(local.tasks);
                if (Array.isArray(local.groceries)) setGroceries(local.groceries);
                if (Array.isArray(local.requests)) setRequests(local.requests);
                if (Array.isArray(local.meals)) setMeals(local.meals);
            }
        })();
    }, []);

    // Persist to Blob (debounced) and localStorage as cache
    useEffect(() => {
        const save = setTimeout(async () => {
            const nowIso = new Date().toISOString();
            try { localStorage.setItem('savedAt', nowIso); } catch (_) {}
            if (usingBlob) {
                try {
                    await fetch('/api/state', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            events,
                            tasks,
                            groceries,
                            requests,
                            meals,
                            savedAt: nowIso,
                        }),
                    });
                } catch (_) {
                    setUsingBlob(false);
                }
            }
        }, 400);
        return () => clearTimeout(save);
    }, [events, tasks, groceries, requests, meals, usingBlob]);

    // Persist collections
    useEffect(() => { try { localStorage.setItem('events', JSON.stringify(events)); } catch (_) {} }, [events]);
    useEffect(() => { try { localStorage.setItem('tasks', JSON.stringify(tasks)); } catch (_) {} }, [tasks]);
    useEffect(() => { try { localStorage.setItem('groceries', JSON.stringify(groceries)); } catch (_) {} }, [groceries]);
    useEffect(() => { try { localStorage.setItem('requests', JSON.stringify(requests)); } catch (_) {} }, [requests]);
    useEffect(() => { try { localStorage.setItem('meals', JSON.stringify(meals)); } catch (_) {} }, [meals]);

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

    // Utilities
    const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const parseYmd = (ymd) => {
        if (!ymd) return new Date();
        const parts = String(ymd).split('-').map((p) => parseInt(p, 10));
        if (parts.length === 3 && !parts.some(isNaN)) {
            return new Date(parts[0], parts[1]-1, parts[2]);
        }
        const d = new Date(ymd);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    // Tasks (as checklist items themselves)
    const addTaskForDay = (dayStr, title, recurrence = 'none', type = 'personal') => {
        const trimmed = title.trim();
        if (!trimmed) return;
        const id = generateId();
        setTasks((prev) => [...prev, { id, title: trimmed, date: dayStr, completedDates: [], recurrence, notes: '', type, priority: type==='work' ? 2 : null, estimate: type==='work' ? '' : null }]);
    };
    const toggleTaskDone = (taskId, dayStr) => {
        setTasks((prev) => prev.map((t) => {
            if (t.id !== taskId) return t;
            const list = Array.isArray(t.completedDates) ? [...t.completedDates] : [];
            const idx = list.indexOf(dayStr);
            if (idx >= 0) list.splice(idx, 1); else list.push(dayStr);
            return { ...t, completedDates: list };
        }));
    };
    const deleteTask = (taskId) => {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
    };

    // Events
    const addEventForDay = (dayStr, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        const id = generateId();
        setEvents((prev) => [...prev, { id, title: trimmed, date: dayStr, notes: '' }]);
    };
    const deleteEvent = (eventId) => {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
    };

    // Groceries
    const handleAddGrocery = () => {
        const name = groceryName.trim();
        if (!name) return;
        const id = generateId();
        const payload = { id, name, quantity: groceryQty.trim() || '1', checked: false };
        setGroceries((prev) => [...prev, payload]);
        setGroceryName('');
        setGroceryQty('');
    };
    const toggleGrocery = (groceryId) => {
        setGroceries((prev) => prev.map((g) => g.id === groceryId ? { ...g, checked: !g.checked } : g));
    };
    const clearCheckedGroceries = () => {
        setGroceries((prev) => prev.filter((g) => !g.checked));
    };
    const deleteGrocery = (groceryId) => {
        setGroceries((prev) => prev.filter((g) => g.id !== groceryId));
    };

    // Requests
    const handleAddRequest = (dueDayStr, title, priority, details) => {
        const t = title.trim();
        if (!t) return;
        const id = generateId();
        const payload = {
            id,
            title: t,
            details: (details || '').trim(),
            priority,
            requestedDueDate: new Date(dueDayStr).toISOString(),
            approved: false,
            approvedDueDate: null,
            status: 'pending',
        };
        setRequests((prev) => [...prev, payload]);
        setNewRequestTitle('');
        setRequestDetails('');
        setNewRequestPriority('medium');
    };
    const approveRequest = (requestId, newDueDateStr) => {
        setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, approved: true, status: 'approved', approvedDueDate: newDueDateStr ? new Date(newDueDateStr).toISOString() : (r.requestedDueDate || null) } : r));
    };
    const completeRequest = (requestId) => {
        setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'completed' } : r));
    };
    const deleteRequest = (requestId) => {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
    };

    // Calendar rendering logic
    const occursOnDay = (task, dayDate) => {
        // task.date is base date string (YYYY-MM-DD)
        try {
            const base = new Date(task.date + 'T00:00:00');
            const target = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
            if (target < base) return false;
            const diffDays = Math.floor((target - base) / (1000 * 60 * 60 * 24));
            const rec = task.recurrence || 'none';
            if (rec === 'none') return diffDays === 0;
            if (rec === 'daily') return true;
            if (rec === 'weekly') return diffDays % 7 === 0;
            if (rec === 'biweekly') return diffDays % 14 === 0;
            if (rec === 'monthly') {
                return target.getDate() === base.getDate();
            }
            return false;
        } catch (_) { return false; }
    };

    const isTaskDoneOnDate = (task, dayStr) => Array.isArray(task.completedDates) && task.completedDates.includes(dayStr);

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

            const tasksToday = tasks.filter(t => t.recurrence !== 'daily' && occursOnDay(t, dayDate));
            const eventsToday = events.filter(e => e.date === dayStr);
            const requestsToday = requests.filter(r => r.status === 'approved' && r.approvedDueDate && formatDate(r.approvedDueDate) === dayStr);

            calendarDays.push(
                <div
                    key={dayStr}
                    className={dayClasses + " cursor-pointer hover:bg-gray-50"}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDayStr(dayStr)}
                    onKeyDown={(e)=>{ if (e.key==='Enter' || e.key===' ') setSelectedDayStr(dayStr); }}
                >
                    <span className="font-medium text-gray-700">{day}</span>
                    <div className="mt-1 w-full space-y-1">
                        {eventsToday.map((ev) => (
                            <div key={`ev-${ev.id}`} className="w-full text-[10px] text-white rounded-lg shadow px-1.5 py-0.5 truncate" style={{ backgroundColor: '#E6E6FA' }} title={ev.title}>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium truncate text-gray-800">{ev.title}</span>
                                    <button className="text-gray-600 hover:text-gray-900" onClick={(e)=>{ e.stopPropagation(); deleteEvent(ev.id); }}><Trash2 size={12} /></button>
                                </div>
                            </div>
                        ))}
                        {tasksToday.map((t) => (
                            <div key={`t-${t.id}`} className="w-full text-[10px] text-white rounded-lg shadow px-1.5 py-0.5 truncate flex items-center gap-1" style={{ backgroundColor: (t.type||'personal')==='work' ? '#f59e0b' : '#3b82f6' }}>
                                <span className={`truncate ${isTaskDoneOnDate(t, dayStr) ? 'line-through' : ''}`}>{t.title}</span>
                                {t.recurrence && t.recurrence !== 'none' && <span className="ml-1 opacity-80">({t.recurrence})</span>}
                                <button className="ml-auto hover:bg-white/10 rounded p-0.5" onClick={(e)=>{ e.stopPropagation(); deleteTask(t.id); }}><Trash2 size={12} /></button>
                                    </div>
                        ))}
                        {requestsToday.map((r) => (
                            <div key={`rq-${r.id}`} className="w-full text-[10px] rounded-lg shadow px-1.5 py-0.5 truncate" style={{ backgroundColor: '#ffd6e7', color: '#7a2946' }} title={`${r.title} (${r.priority})`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium truncate">{r.title}</span>
                                    <button className="hover:bg-black/5 rounded p-0.5" onClick={(e)=>{ e.stopPropagation(); deleteRequest(r.id); }}><Trash2 size={12} /></button>
                                    </div>
                                </div>
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
            <div className="w-full max-w-7xl mx-auto space-y-4">

                {/* Tabs */}
                <div className="bg-white p-2 rounded-2xl shadow border border-gray-200">
                    <div className="flex flex-wrap gap-2 items-center">
                        <button onClick={() => setActiveTab('calendar')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='calendar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><CalendarDays size={16} /> Calendar</button>
                        <button onClick={() => setActiveTab('groceries')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='groceries' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><ShoppingCart size={16} /> Groceries</button>
                        <button onClick={() => setActiveTab('requests')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='requests' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Star size={16} /> Requests</button>
                        <button onClick={() => setActiveTab('work')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='work' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Briefcase size={16} /> Work</button>
                        <div className="ml-auto flex items-center gap-2">
                            {usingBlob ? (
                                <span className="text-xs text-green-700 bg-green-100 border border-green-200 rounded px-2 py-1">Blob</span>
                            ) : (
                                <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-1" title="Falling back to local storage">Offline</span>
                            )}
                            <button
                                disabled={isBackingUp}
                                onClick={async ()=>{
                                    try {
                                        setIsBackingUp(true);
                                        const payload = {
                                            events,
                                            tasks,
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
                                        if (Array.isArray(d.events)) setEvents(d.events);
                                        if (Array.isArray(d.tasks)) setTasks(d.tasks);
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
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800">{monthNames[month]} {year}</h3>
                        <div className="flex items-center gap-2">
                                <button onClick={()=> setSelectedDayStr(formatDate(new Date()))} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Open Today</button>
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
                    {/* Daily Tasks Sidebar */}
                    <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-200 h-fit lg:sticky lg:top-4">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-gray-800">Tasks</h4>
                            <div className="flex items-center gap-2">
                                <select value={sidebarRecurrence} onChange={(e)=>setSidebarRecurrence(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-[11px]">
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="biweekly">Biweekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                                <span className="text-[10px] text-gray-500">{formatDate(new Date())}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {tasks.filter(t=>t.recurrence===sidebarRecurrence).length===0 && (
                                <div className="text-xs text-gray-500">No {sidebarRecurrence} tasks.</div>
                            )}
                            {tasks.filter(t=>t.recurrence===sidebarRecurrence).map((t)=>{
                                const todayStr = formatDate(new Date());
                                const checked = isTaskDoneOnDate(t, todayStr);
                                return (
                                    <label key={`side-t-${t.id}`} className="flex items-center gap-2 rounded bg-blue-50 border border-blue-200 px-2 py-2 text-xs">
                                        <input type="checkbox" checked={checked} onChange={()=>toggleTaskDone(t.id, todayStr)} />
                                        <span className={checked ? 'line-through text-gray-500' : 'text-gray-800'}>{t.title}</span>
                                        <button className="ml-auto text-gray-600 hover:text-gray-900" onClick={()=>deleteTask(t.id)}><Trash2 size={12}/></button>
                                    </label>
                                );
                            })}
                </div>
            </div>
                </div>
            )}

                {/* Day Modal */}
            {selectedDayStr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={()=>setSelectedDayStr(null)} />
                    <div className="relative bg-white w-full max-w-2xl mx-4 rounded-2xl shadow-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-lg font-bold text-gray-800">{new Date(selectedDayStr+"T00:00:00").toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric'})}</div>
                            <button className="p-1 rounded hover:bg-gray-100" onClick={()=>setSelectedDayStr(null)}><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                                    <select value={newItemType} onChange={(e)=>setNewItemType(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                                        <option value="task">Task</option>
                                        <option value="event">Event</option>
                                    </select>
                                    {newItemType==='task' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={newTaskRecurrence} onChange={(e)=>setNewTaskRecurrence(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                                                <option value="none">One-time</option>
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="biweekly">Biweekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                            <select value={newTaskType} onChange={(e)=>setNewTaskType(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                                                <option value="personal">Personal</option>
                                                <option value="work">Work</option>
                                            </select>
                                        </div>
                                    )}
                                    <input value={newItemTitle} onChange={(e)=>setNewItemTitle(e.target.value)} placeholder={newItemType==='task'?"Add task":"Add event"} className="md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg" />
                                    <button className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700" onClick={()=>{
                                        const t = (newItemTitle||'').trim(); if (!t) return;
                                        if (newItemType==='task') { addTaskForDay(selectedDayStr, t, newTaskRecurrence, newTaskType); }
                                        else { addEventForDay(selectedDayStr, t); }
                                        setNewItemTitle('');
                                        setNewTaskRecurrence('none');
                                        setNewTaskType('personal');
                                    }}>Add</button>
                                </div>
                                </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <div className="text-sm font-semibold text-gray-700">Tasks</div>
                                    {tasks.filter(t=> occursOnDay(t, parseYmd(selectedDayStr))).map((t)=>{
                                        const checked = isTaskDoneOnDate(t, selectedDayStr);
                                        const isEditing = editingTaskId === t.id;
                                        return (
                                            <div key={t.id} className="rounded p-2 text-xs" style={{ backgroundColor: (t.type||'personal')==='work' ? '#FEF3C7' : '#EFF6FF', border: '1px solid ' + ((t.type||'personal')==='work' ? '#FCD34D' : '#BFDBFE') }}>
                                                {!isEditing ? (
                                                    <div className="flex items-start gap-2">
                                                        <input type="checkbox" className="mt-0.5" checked={checked} onChange={()=>toggleTaskDone(t.id, selectedDayStr)} />
                                                        <div className="min-w-0">
                                                            <div className={checked ? 'line-through text-gray-500 truncate' : 'text-gray-800 truncate'} title={t.title}>{t.title}</div>
                                                            {t.notes && <div className="text-[11px] text-gray-600 truncate" title={t.notes}>{t.notes}</div>}
                                                            <div className="flex items-center gap-2 text-[10px]">
                                                                {t.recurrence && t.recurrence!=='none' && <span className="text-blue-700">({t.recurrence})</span>}
                                                                <span className="px-1.5 py-0.5 rounded border" style={{ backgroundColor: (t.type||'personal')==='work' ? '#FDE68A' : '#DBEAFE', borderColor: (t.type||'personal')==='work' ? '#FCD34D' : '#BFDBFE', color: '#374151' }}>{(t.type||'personal')==='work' ? 'Work' : 'Personal'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="ml-auto flex items-center gap-2">
                                                            <button className="text-gray-600 hover:text-gray-900" onClick={()=>{ setEditingTaskId(t.id); setEditTaskTitle(t.title); setEditTaskNotes(t.notes||''); }} title="Edit">✎</button>
                                                            <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteTask(t.id)} title="Delete"><Trash2 size={12}/></button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <input value={editTaskTitle} onChange={(e)=>setEditTaskTitle(e.target.value)} className="w-full px-2 py-1 border border-blue-200 rounded text-xs" placeholder="Task title" />
                                                        <textarea value={editTaskNotes} onChange={(e)=>setEditTaskNotes(e.target.value)} rows={2} className="w-full px-2 py-1 border border-blue-200 rounded text-xs" placeholder="Notes (optional)" />
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-[11px] text-gray-700">Repeat</label>
                                                            <select value={t.recurrence||'none'} onChange={(e)=> setTasks((prev)=> prev.map((x)=> x.id===t.id ? { ...x, recurrence: e.target.value } : x))} className="px-2 py-1 border border-blue-200 rounded text-xs">
                                                                <option value="none">One-time</option>
                                                                <option value="daily">Daily</option>
                                                                <option value="weekly">Weekly</option>
                                                                <option value="biweekly">Biweekly</option>
                                                                <option value="monthly">Monthly</option>
                                                            </select>
                                                            <label className="text-[11px] text-gray-700 ml-2">Type</label>
                                                            <select value={t.type||'personal'} onChange={(e)=> setTasks((prev)=> prev.map((x)=> x.id===t.id ? { ...x, type: e.target.value } : x))} className="px-2 py-1 border border-blue-200 rounded text-xs">
                                                                <option value="personal">Personal</option>
                                                                <option value="work">Work</option>
                                                            </select>
                                                            <div className="ml-auto flex items-center gap-2">
                                                                <button className="text-xs bg-blue-600 text-white rounded px-2 py-1" onClick={()=>{
                                                                    const title = editTaskTitle.trim(); if (!title) return;
                                                                    setTasks((prev)=> prev.map((x)=> x.id===t.id ? { ...x, title, notes: editTaskNotes } : x));
                                                                    setEditingTaskId(null); setEditTaskTitle(''); setEditTaskNotes('');
                                                                }}>Save</button>
                                                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>{ setEditingTaskId(null); setEditTaskTitle(''); setEditTaskNotes(''); }}>Cancel</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {tasks.filter(t=> occursOnDay(t, parseYmd(selectedDayStr))).length===0 && (
                                        <div className="text-xs text-gray-500">No tasks for this day.</div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="text-sm font-semibold text-gray-700">Events</div>
                                    {events.filter(e=> e.date===selectedDayStr).map((e)=>{
                                        const isEditing = editingEventId === e.id;
                                        return (
                                            <div key={e.id} className="w-full text-[12px] rounded-lg shadow px-2 py-2" style={{ backgroundColor: '#E6E6FA' }}>
                                                {!isEditing ? (
                                                    <div className="flex items-start gap-2">
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-gray-800 truncate" title={e.title}>{e.title}</div>
                                                            {e.notes && <div className="text-[11px] text-gray-700 truncate" title={e.notes}>{e.notes}</div>}
                                                        </div>
                                                        <div className="ml-auto flex items-center gap-2">
                                                            <button className="text-gray-700 hover:text-gray-900" onClick={()=>{ setEditingEventId(e.id); setEditEventTitle(e.title); setEditEventNotes(e.notes||''); }} title="Edit">✎</button>
                                                            <button className="text-gray-700 hover:text-gray-900" onClick={()=>deleteEvent(e.id)} title="Delete"><Trash2 size={14}/></button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <input value={editEventTitle} onChange={(ev)=>setEditEventTitle(ev.target.value)} className="w-full px-2 py-1 border border-purple-200 rounded text-xs" placeholder="Event title" />
                                                        <textarea value={editEventNotes} onChange={(ev)=>setEditEventNotes(ev.target.value)} rows={2} className="w-full px-2 py-1 border border-purple-200 rounded text-xs" placeholder="Notes (optional)" />
                                                        <div className="flex items-center gap-2">
                                                            <button className="text-xs bg-blue-600 text-white rounded px-2 py-1" onClick={()=>{
                                                                const title = editEventTitle.trim(); if (!title) return;
                                                                setEvents((prev)=> prev.map((x)=> x.id===e.id ? { ...x, title, notes: editEventNotes } : x));
                                                                setEditingEventId(null); setEditEventTitle(''); setEditEventNotes('');
                                                            }}>Save</button>
                                                            <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>{ setEditingEventId(null); setEditEventTitle(''); setEditEventNotes(''); }}>Cancel</button>
                                            </div>
                                    </div>
                                )}
                            </div>
                                        );
                                    })}
                                    {events.filter(e=> e.date===selectedDayStr).length===0 && (
                                        <div className="text-xs text-gray-500">No events for this day.</div>
                                    )}
                                </div>
                                                        </div>
                                                    </div>
                                                    </div>
                                                </div>
                )}

                {/* Groceries Tab */}
                {activeTab === 'groceries' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className={`text-sm font-semibold px-3 py-1 rounded cursor-pointer ${groceriesSubtab==='list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={()=>setGroceriesSubtab('list')}>List</div>
                        <div className={`text-sm font-semibold px-3 py-1 rounded cursor-pointer ${groceriesSubtab==='planner' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={()=>setGroceriesSubtab('planner')}>Meal Planner</div>
                    </div>

                    {groceriesSubtab==='list' && (
                        <>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                                    <input value={groceryName} onChange={(e)=>setGroceryName(e.target.value)} placeholder="Item" className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                                    <input value={groceryQty} onChange={(e)=>setGroceryQty(e.target.value)} placeholder="Qty" className="px-3 py-2 border border-gray-300 rounded-lg" />
                                    <div className="md:col-span-2" />
                                    <button onClick={handleAddGrocery} className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700">Add Item</button>
                                                        </div>
                                                    </div>
                            <div className="space-y-2">
                                {groceries.map((g)=> (
                                    <label key={g.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                        <input type="checkbox" checked={!!g.checked} onChange={()=>toggleGrocery(g.id)} />
                                        <div>
                                            <div className={`text-sm font-semibold ${g.checked ? 'line-through text-gray-500' : 'text-gray-800'}`}>{g.name} {g.quantity ? `· ${g.quantity}` : ''}</div>
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
                        </>
                    )}

                    {groceriesSubtab==='planner' && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                                <div className="text-sm font-semibold text-gray-700">Create Meal</div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <input value={mealTitle} onChange={(e)=>setMealTitle(e.target.value)} placeholder="Meal title" className="px-3 py-2 border border-gray-300 rounded-lg" />
                                    <input value={mealLink} onChange={(e)=>setMealLink(e.target.value)} placeholder="Recipe link (optional)" className="px-3 py-2 border border-gray-300 rounded-lg" />
                                    <div className="md:col-span-1" />
                                </div>
                                <textarea value={mealRecipe} onChange={(e)=>setMealRecipe(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Recipe notes (optional)" />
                                        <div className="space-y-2">
                                    <div className="text-xs font-semibold text-gray-600">Ingredients</div>
                                    {(mealIngredients||[]).map((ing)=> (
                                        <div key={ing.id} className="flex items-center gap-2 text-xs">
                                            <span>{ing.name} {ing.quantity ? `· ${ing.quantity}` : ''}</span>
                                            <button className="ml-auto text-gray-600 hover:text-gray-900" onClick={()=> setMealIngredients((prev)=> prev.filter(i=>i.id!==ing.id))}><Trash2 size={12}/></button>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <input value={ingName} onChange={(e)=>setIngName(e.target.value)} placeholder="Ingredient" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs" />
                                        <input value={ingQty} onChange={(e)=>setIngQty(e.target.value)} placeholder="Qty" className="w-28 px-2 py-1 border border-gray-300 rounded text-xs" />
                                        <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>{
                                            const n = ingName.trim();
                                            if (!n) return; setMealIngredients((prev)=> [...prev, { id: generateId(), name: n, quantity: ingQty.trim() }]); setIngName(''); setIngQty('');
                                        }}>Add</button>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button className="text-xs bg-blue-600 text-white rounded px-3 py-1" onClick={()=>{
                                        const t = mealTitle.trim(); if (!t) return;
                                        const id = generateId();
                                        setMeals((prev)=> [...prev, { id, title: t, recipe: mealRecipe.trim(), link: mealLink.trim(), ingredients: mealIngredients }]);
                                        setMealTitle(''); setMealRecipe(''); setMealLink(''); setMealIngredients([]);
                                    }}>Save Meal</button>
                                </div>
                                                    </div>

                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-gray-700">Plan Week</div>
                                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600">Week starting</label>
                                        <input type="date" value={plannerWeekStart} onChange={(e)=>setPlannerWeekStart(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs" />
                                                    </div>
                                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                                    {[0,1,2,3,4,5,6].map((offset)=>{
                                        const start = parseYmd(plannerWeekStart);
                                        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+offset);
                                        const ymd = formatDate(d);
                                        const label = d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'});
                                        return (
                                            <div key={offset} className="border border-gray-200 rounded p-2 space-y-2">
                                                <div className="text-xs font-semibold text-gray-700">{label}</div>
                                                <select className="w-full px-2 py-1 border border-gray-300 rounded text-xs" value={plannerSelection[ymd]||''} onChange={(e)=> setPlannerSelection((prev)=> ({...prev, [ymd]: e.target.value}))}>
                                                    <option value="">Select meal…</option>
                                                    {meals.map((m)=> <option key={m.id} value={m.id}>{m.title}</option>)}
                                                </select>
                                        </div>
                                    );
                                    })}
                            </div>
                                <div className="flex justify-end">
                                    <button className="text-sm bg-green-600 text-white rounded px-3 py-2 hover:bg-green-700" onClick={()=>{
                                        // Add selected meals to calendar as events and push ingredients to groceries
                                        const addedGroceries = [];
                                        Object.entries(plannerSelection).forEach(([ymd, mealId])=>{
                                            if (!mealId) return;
                                            const meal = meals.find(m=>m.id===mealId); if (!meal) return;
                                            // create event
                                            setEvents((prev)=> [...prev, { id: generateId(), title: meal.title, date: ymd, notes: meal.link ? `Recipe: ${meal.link}\n` + (meal.recipe||'') : (meal.recipe||'') }]);
                                            // add ingredients
                                            (meal.ingredients||[]).forEach((ing)=>{
                                                addedGroceries.push({ id: generateId(), name: ing.name, quantity: ing.quantity||'', checked: false });
                                            });
                                        });
                                        if (addedGroceries.length>0) setGroceries((prev)=> [...prev, ...addedGroceries]);
                                        // Clear selection
                                        setPlannerSelection({});
                                    }}>Make Plan</button>
                        </div>
                    </div>
                </div>
            )}
                </div>
                )}

                {/* Requests Tab */}
                {activeTab === 'requests' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-6">
                    <div className="text-xl font-bold text-gray-800">Fiancé Requests</div>
                    <div className="text-xs text-gray-500">Add, approve, or complete requests. Approved requests appear on the calendar (light pink) on their approved date.</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                            <input value={reqFormTitle} onChange={(e)=>setReqFormTitle(e.target.value)} placeholder="Title" className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            <select value={reqFormPriority} onChange={(e)=>setReqFormPriority(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                            <input type="date" value={reqFormDueDate} onChange={(e)=>setReqFormDueDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                            <input value={reqFormDetails} onChange={(e)=>setReqFormDetails(e.target.value)} placeholder="Details (optional)" className="px-3 py-2 border border-gray-300 rounded-lg md:col-span-2" />
                            <button className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700" onClick={()=>{
                                if (!reqFormTitle.trim()) return;
                                const id = generateId();
                                const payload = {
                                    id,
                                    title: reqFormTitle.trim(),
                                    details: reqFormDetails.trim(),
                                    priority: reqFormPriority,
                                    requestedDueDate: reqFormDueDate ? new Date(reqFormDueDate).toISOString() : null,
                                    approved: false,
                                    approvedDueDate: null,
                                    status: 'pending',
                                };
                                setRequests((prev)=>[...prev, payload]);
                                setReqFormTitle(''); setReqFormDetails(''); setReqFormDueDate(''); setReqFormPriority('medium');
                            }}>Add</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {requests.length === 0 && <div className="text-xs text-gray-500">No requests.</div>}
                        {requests.sort((a,b)=>{
                            const pri = { high: 0, medium: 1, low: 2 };
                            return pri[a.priority]-pri[b.priority];
                        }).map((r)=>(
                            <div key={r.id} className="flex items-center justify-between rounded px-3 py-2 text-sm" style={{ backgroundColor: '#ffd6e7', border: '1px solid #f5a6bd' }}>
                                <div>
                                    <div className="font-semibold text-[#7a2946]">{r.title}</div>
                                    <div className="text-xs text-[#7a2946]">Priority: <span className="capitalize">{r.priority}</span>{r.requestedDueDate ? ` · requested ${new Date(r.requestedDueDate).toLocaleDateString()}` : ''}{r.approvedDueDate ? ` · approved ${new Date(r.approvedDueDate).toLocaleDateString()}` : ''}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {r.status==='pending' && (
                                        <>
                                            <input type="date" defaultValue={r.requestedDueDate ? formatDate(r.requestedDueDate) : ''} onChange={(e)=>approveRequest(r.id, e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs" />
                                            <button className="text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700" onClick={()=>approveRequest(r.id, r.requestedDueDate ? formatDate(r.requestedDueDate) : formatDate(new Date()))}>Approve</button>
                                        </>
                                    )}
                                    {r.status!=='completed' && <button className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700" onClick={()=>completeRequest(r.id)}>Done</button>}
                                    <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteRequest(r.id)}><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                )}

                {/* Work Tab */}
                {activeTab === 'work' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-4">
                    <div className="flex items-center gap-2">
                        <Briefcase size={18} />
                        <div className="text-xl font-bold text-gray-800">Work — Today</div>
                        <div className="ml-auto text-xs text-gray-500">{formatDate(new Date())}</div>
                    </div>
                    <div className="space-y-2">
                        {tasks.filter(t=> (t.type||'personal')==='work' && occursOnDay(t, new Date()) ).length===0 && (
                            <div className="text-xs text-gray-500">No work tasks for today.</div>
                        )}
                        {tasks
                            .filter(t=> (t.type||'personal')==='work' && occursOnDay(t, new Date()))
                            .sort((a,b)=> (a.priority||3) - (b.priority||3))
                            .map((t)=>{
                            const todayStr = formatDate(new Date());
                            const checked = isTaskDoneOnDate(t, todayStr);
                            return (
                                <div key={`work-${t.id}`} className="rounded px-3 py-2 text-sm flex items-center gap-2" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FCD34D' }}>
                                    <input type="checkbox" checked={checked} onChange={()=>toggleTaskDone(t.id, todayStr)} />
                                    <div className="min-w-0">
                                        <div className={checked ? 'line-through text-gray-500 truncate' : 'text-gray-800 truncate'} title={t.title}>{t.title}</div>
                                        {t.notes && <div className="text-xs text-gray-600 truncate" title={t.notes}>{t.notes}</div>}
                                        {t.recurrence && t.recurrence!=='none' && <div className="text-[11px] text-gray-600">({t.recurrence})</div>}
                                    </div>
                                    <div className="ml-auto flex items-center gap-2">
                                        <button className="text-gray-700 hover:text-gray-900" title="Open notes" onClick={()=>{ setWorkNotesTaskId(t.id); setWorkNotesDraft(t.notes||''); }}>
                                            <Clipboard size={16} />
                                        </button>
                                        <div className="flex items-center gap-1 text-xs">
                                            <span className="text-gray-600">P</span>
                                            <select value={t.priority ?? 3} onChange={(e)=> setTasks((prev)=> prev.map(x=> x.id===t.id ? { ...x, priority: parseInt(e.target.value,10) } : x))} className="px-1 py-0.5 border border-amber-300 rounded">
                                                <option value={1}>1</option>
                                                <option value={2}>2</option>
                                                <option value={3}>3</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs">
                                            <span className="text-gray-600">Est</span>
                                            <select value={t.estimate || ''} onChange={(e)=> setTasks((prev)=> prev.map(x=> x.id===t.id ? { ...x, estimate: e.target.value } : x))} className="px-1 py-0.5 border border-amber-300 rounded">
                                                <option value="">—</option>
                                                <option value="30m">30m</option>
                                                <option value="1h">1h</option>
                                                <option value="90m">90m</option>
                                                <option value="2h">2h</option>
                                                <option value="3h">3h</option>
                                            </select>
                                        </div>
                                        <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteTask(t.id)}><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}

                {/* Work Task Notes Modal */}
                {workNotesTaskId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/30" onClick={()=>{ setWorkNotesTaskId(null); setWorkNotesDraft(''); }} />
                        <div className="relative bg-white w-full max-w-md mx-4 rounded-2xl shadow-xl border border-gray-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold text-gray-800">Task Notes</div>
                                <button className="p-1 rounded hover:bg-gray-100" onClick={()=>{ setWorkNotesTaskId(null); setWorkNotesDraft(''); }}><X size={16} /></button>
                            </div>
                            <textarea value={workNotesDraft} onChange={(e)=>setWorkNotesDraft(e.target.value)} rows={8} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" placeholder="Add notes..." />
                            <div className="mt-3 flex justify-end gap-2">
                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-3 py-1" onClick={()=>{ setWorkNotesTaskId(null); setWorkNotesDraft(''); }}>Cancel</button>
                                <button className="text-xs bg-blue-600 text-white rounded px-3 py-1" onClick={()=>{
                                    const id = workNotesTaskId;
                                    setTasks((prev)=> prev.map(x=> x.id===id ? { ...x, notes: workNotesDraft } : x));
                                    setWorkNotesTaskId(null); setWorkNotesDraft('');
                                }}>Save</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

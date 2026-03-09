import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Github, Terminal, Settings } from 'lucide-react';

const Sidebar = () => {
    const navItems = [
        { id: 'sessions', label: 'Sessions', path: '/sessions', icon: LayoutDashboard },
        { id: 'sources', label: 'Sources', path: '/sources', icon: Github },
        { id: 'cli', label: 'CLI Recipes', path: '/cli', icon: Terminal },
        { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
    ];

    return (
        <aside className="w-64 border-r border-gray-800 bg-[#0F0F11] flex flex-col z-20">
            <div className="p-6">
                <div className="flex items-center gap-3 text-white">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
                        <Terminal size={18} className="text-white" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">Jules Studio</span>
                </div>
            </div>

            <nav className="flex-1 px-4 py-2 space-y-1">
                {navItems.map(item => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        className={({ isActive }) => 
                            `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                isActive
                                    ? 'bg-blue-600/10 text-blue-400'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon size={18} className={isActive ? 'text-blue-500' : 'text-gray-500'} />
                                {item.label}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
};

export default Sidebar;

import React, { useState } from 'react';
// FIX: Use namespace import for react-router-dom to resolve potential module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { useGroupData } from '../hooks/useGroupData';

const { Link, useNavigate } = ReactRouterDOM;

const HomePage: React.FC = () => {
    const { groups, addGroup, deleteGroup, loading } = useGroupData();
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupPlayers, setNewGroupPlayers] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const navigate = useNavigate();

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        const players = newGroupPlayers.split(',').map(p => p.trim()).filter(Boolean);
        if (newGroupName && players.length > 0) {
            setIsCreating(true);
            try {
                const newGroup = await addGroup(newGroupName, players);
                setNewGroupName('');
                setNewGroupPlayers('');
                navigate(`/group/${newGroup.id}`);
            } catch (error) {
                console.error("Failed to create group:", error);
                alert("Could not create the group. Please try again.");
            } finally {
                setIsCreating(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-2xl mx-auto">
                <header className="text-center mb-12">
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase">Wordle Escrow</h1>
                    <p className="text-gray-400 mt-2">Create or select a group to start.</p>
                </header>

                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <h2 className="text-2xl font-bold mb-4">Create New Group</h2>
                    <form onSubmit={handleCreateGroup} className="space-y-4">
                        <div>
                            <label htmlFor="group-name" className="block text-sm font-medium text-gray-300 mb-1">Group Name</label>
                            <input
                                id="group-name"
                                type="text"
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                placeholder="e.g., The Wordle Warriors"
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="group-players" className="block text-sm font-medium text-gray-300 mb-1">Players (comma-separated)</label>
                            <input
                                id="group-players"
                                type="text"
                                value={newGroupPlayers}
                                onChange={e => setNewGroupPlayers(e.target.value)}
                                placeholder="e.g., Mary, Alex, Pete"
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
                                required
                            />
                        </div>
                        <button type="submit" disabled={isCreating} className="w-full bg-wordle-green text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition duration-200 disabled:bg-gray-500">
                            {isCreating ? 'Creating...' : 'Create Group'}
                        </button>
                    </form>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-bold mb-4">Select Existing Group</h2>
                    {loading && <p className="text-gray-400">Loading groups...</p>}
                    {!loading && groups.length > 0 ? (
                        <ul className="space-y-3">
                            {groups.map(group => (
                                <li key={group.id} className="flex justify-between items-center bg-gray-700 p-3 rounded-md">
                                    <Link to={`/group/${group.id}`} className="font-semibold hover:text-wordle-green flex-grow">{group.name}</Link>
                                    <button onClick={() => {if(confirm(`Are you sure you want to delete "${group.name}"? This cannot be undone.`)) deleteGroup(group.id)}} className="text-red-500 hover:text-red-400 text-sm">Delete</button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !loading && <p className="text-gray-400">No groups found. Create one to get started!</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomePage;

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGroupData } from '../hooks/useGroupData';

const SettingsPage: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const { getGroupById, updateGroup, deleteGroup, loading } = useGroupData();
    const navigate = useNavigate();
    
    const group = getGroupById(groupId!);
    
    const [groupName, setGroupName] = useState('');
    const [players, setPlayers] = useState('');

    useEffect(() => {
        if (group) {
            setGroupName(group.name);
            setPlayers(group.players.join(', '));
        } else if (!loading && groupId) { // Only redirect if not loading and group is not found
            navigate('/');
        }
    }, [group, loading, groupId, navigate]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const playerList = players.split(',').map(p => p.trim()).filter(Boolean);
        if (groupName && playerList.length > 0 && groupId) {
            updateGroup(groupId, { name: groupName, players: playerList });
            alert('Group saved successfully!');
            navigate(`/group/${groupId}`);
        }
    };
    
    const handleDelete = () => {
        if (groupId && group && confirm(`Are you sure you want to permanently delete the group "${group.name}" and all its data? This cannot be undone.`)) {
            deleteGroup(groupId);
            navigate('/');
        }
    }

    if (loading) {
        return <div className="min-h-screen bg-wordle-dark text-wordle-light flex items-center justify-center">Loading settings...</div>;
    }

    if (!group) {
        return null; // Render nothing while the redirect effect runs
    }

    return (
        <div className="min-h-screen bg-wordle-dark text-wordle-light font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-2xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-wider">Settings</h1>
                    <p className="text-gray-400 mt-2">Manage group: <span className="font-semibold text-wordle-green">{group.name}</span></p>
                </header>

                <form onSubmit={handleSave} className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-6">
                    <div>
                        <label htmlFor="group-name" className="block text-sm font-medium text-gray-300 mb-1">Group Name</label>
                        <input
                            id="group-name"
                            type="text"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="group-players" className="block text-sm font-medium text-gray-300 mb-1">Players (comma-separated)</label>
                        <textarea
                            id="group-players"
                            rows={3}
                            value={players}
                            onChange={e => setPlayers(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-wordle-green"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Warning: Removing a player will not delete their past data, but they will not be included in future stats calculations.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                         <Link to={`/group/${groupId}`} className="w-full text-center bg-gray-600 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-500 transition duration-200">
                            Cancel
                        </Link>
                        <button type="submit" className="w-full bg-wordle-green text-white font-bold py-2 px-4 rounded-md hover:bg-green-600 transition duration-200">
                            Save Changes
                        </button>
                    </div>
                </form>

                <div className="mt-8 bg-gray-800 p-6 rounded-lg shadow-lg border border-red-900">
                    <h3 className="text-xl font-bold text-red-400">Danger Zone</h3>
                    <p className="text-gray-400 my-2">Deleting your group is permanent. All associated scores and history will be lost forever.</p>
                    <button onClick={handleDelete} className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-md hover:bg-red-700 transition duration-200">
                        Delete This Group
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;

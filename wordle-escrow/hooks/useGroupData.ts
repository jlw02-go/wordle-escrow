import { useState, useEffect, useCallback } from 'react';
import { Group } from '../types';
import { nanoid } from 'nanoid';
import { db } from '../firebase';
// FIX: Use namespace import for firestore to maintain consistency with module resolution fixes.
import * as firestore from 'firebase/firestore';

export const useGroupData = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) {
            setLoading(false);
            return;
        }
        const q = firestore.query(firestore.collection(db, 'groups'), firestore.orderBy('createdAt', 'asc'));
        const unsubscribe = firestore.onSnapshot(q, (snapshot) => {
            const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
            setGroups(groupsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching groups:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const addGroup = useCallback(async (name: string, players: string[]) => {
        if (!db) throw new Error("Firebase is not configured.");
        const newGroup: Omit<Group, 'id'> = {
            name,
            players,
            createdAt: new Date().toISOString(),
        };
        const docRef = await firestore.addDoc(firestore.collection(db, 'groups'), newGroup);
        return { ...newGroup, id: docRef.id };
    }, []);

    const updateGroup = useCallback(async (id: string, updates: Partial<Pick<Group, 'name' | 'players'>>) => {
        if (!db) return;
        const groupDoc = firestore.doc(db, 'groups', id);
        await firestore.updateDoc(groupDoc, updates);
    }, []);

    const deleteGroup = useCallback(async (id: string) => {
        if (!db) return;
        // Note: Deleting a group won't delete its subcollections (submissions) automatically.
        // This would require a more complex cloud function for a production app.
        // For this app's scope, we just delete the group doc.
        const groupDoc = firestore.doc(db, 'groups', id);
        await firestore.deleteDoc(groupDoc);
    }, []);
    
    const getGroupById = useCallback((id: string) => {
        return groups.find(g => g.id === id);
    }, [groups]);

    return {
        groups,
        loading,
        addGroup,
        updateGroup,
        deleteGroup,
        getGroupById,
    };
};
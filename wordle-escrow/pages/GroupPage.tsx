// Seed and load roster from Firestore
useEffect(() => {
  let cancelled = false;
  if (!db || !groupId) return;

  (async () => {
    try {
      setLoadingRoster(true);
      const gref = doc(db, 'groups', groupId);
      const snap = await getDoc(gref);
      if (!snap.exists()) {
        await setDoc(gref, { name: groupName, players: DEFAULT_PLAYERS });
        if (!cancelled) setPlayers(DEFAULT_PLAYERS);
      } else {
        const data = snap.data() as any;
        const list: string[] = Array.isArray(data.players) ? data.players : [];
        if (list.length === 0) {
          await updateDoc(gref, { players: DEFAULT_PLAYERS });
          if (!cancelled) setPlayers(DEFAULT_PLAYERS);
        } else {
          const merged = Array.from(new Set([...DEFAULT_PLAYERS, ...list])).slice(0, 10);
          if (!cancelled) setPlayers(merged);
        }
      }
    } catch (e: any) {
      console.error(e);
      if (!cancelled) {
        setError("Couldn't load group roster.");
        setPlayers(DEFAULT_PLAYERS); // fail safe
      }
    } finally {
      if (!cancelled) setLoadingRoster(false);
    }
  })();

  return () => { cancelled = true; };
}, [groupId, groupName]);

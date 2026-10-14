import { useState, useCallback } from 'react';

const useActivityLog = () => {
  const [activities, setActivities] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('activityLog'));
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const logActivity = useCallback((description) => {
    setActivities(prevActivities => {
      const newActivity = {
        id: new Date().getTime(),
        date: new Date().toISOString(),
        description: description,
      };
      const updatedActivities = [newActivity, ...prevActivities].slice(0, 5);
      localStorage.setItem('activityLog', JSON.stringify(updatedActivities));
      return updatedActivities;
    });
  }, []);

  return { activities, logActivity };
};

export default useActivityLog;

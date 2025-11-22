import { useState, useEffect, useCallback } from 'react';

const useActivityLog = () => {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const storedActivities = JSON.parse(localStorage.getItem('activityLog')) || [];
    setActivities(storedActivities);
  }, []);

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

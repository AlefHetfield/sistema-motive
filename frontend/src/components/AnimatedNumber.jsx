import React, { useEffect, useState } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

const formatNumber = (v) => {
    if (v === undefined || v === null || Number.isNaN(v)) return '0,00';
    return Number(v).toFixed(2).replace('.', ',');
};

const AnimatedNumber = ({ value = 0, prefix = '', suffix = '' }) => {
    const numeric = parseFloat(value) || 0;
    const motionVal = useMotionValue(numeric);
    const spring = useSpring(motionVal, { stiffness: 200, damping: 30 });
    const [display, setDisplay] = useState(formatNumber(numeric));

    useEffect(() => {
        // update target
        motionVal.set(numeric);
    }, [numeric]);

    useEffect(() => {
        const unsubscribe = spring.on('change', (v) => {
            setDisplay(formatNumber(v));
        });
        return () => unsubscribe && unsubscribe();
    }, [spring]);

    return (
        <span>
            {prefix}
            {display}
            {suffix}
        </span>
    );
};

export default AnimatedNumber;

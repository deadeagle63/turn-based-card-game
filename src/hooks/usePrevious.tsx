import {useLayoutEffect, useRef} from "react";

export default function usePrevious<T>(value: T): T | undefined {
    const currRef = useRef<T>(undefined); //To have a synchronized value before making a change, you need to pass the current value.

    //useLayoutEffect for see the change before ui rendered
    useLayoutEffect(() => {
        currRef.current = value;
    }, [value]);

    // below is a bug that is currently open in latest version of React https://github.com/facebook/react/issues/34775
    // eslint-disable-next-line react-hooks/refs
    return currRef.current;
};
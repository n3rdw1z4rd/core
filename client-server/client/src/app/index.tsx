import { Context, createContext, h } from 'preact';
import Router from 'preact-router';
// import { AccountContext } from '../context';
import { NAVBAR_HEIGHT } from '../constants';
import { NavBar } from '../components';
import { Home } from '../pages';
import styles from './styles.module.css';
import { useMemo, useState } from 'preact/hooks';

export const AppContext = createContext(undefined);

export const App = () => {
    const [account, setAccount] = useState();

    const appContext = useMemo(() => ({ account, setAccount }), [account]);

    return (
        <AppContext.Provider value={appContext}>
            <div className={styles.root}>
                <NavBar />
                <div className={styles.main} style={{ marginTop: NAVBAR_HEIGHT }}>
                    <Router>
                        <Home path={'/'} />
                        {/* <div path={'/a'}>This is /a</div>
                    <div path={'/b'}>This is /b</div> */}
                        {/* <div path={'*'}>404</div> */}
                    </Router>
                </div>
            </div>
        </AppContext.Provider>
    );
};
import { h } from 'preact';
import { NAVBAR_HEIGHT } from '../../constants';
import styles from './styles.module.css';
import { Login } from '../login';

export const NavBar = () => {
    return (
        <header
            className={styles.navHeader}
            style={{ height: NAVBAR_HEIGHT }}
        >
            <nav>
                <a className={styles.navLink} href="/">Home</a>

                {/* {account && <span>
                    <a className={styles.navLink} href="/one">ONE</a>
                    <a className={styles.navLink} href="/two">TWO</a>
                </span>} */}
            </nav>

            <Login />
        </header>
    );
}
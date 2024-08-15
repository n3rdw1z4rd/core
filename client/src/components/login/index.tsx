import { h } from 'preact';
import { useContext } from 'preact/hooks';
import { AppContext } from '../../app';

export const Login = () => {
    const account = useContext(AppContext);

    account.setAccount('jimmy');

    console.debug('*** account:', account);

    return (
        <div>LOGIN:
            {/* {account ?
                <span>
                    <a className={styles.navLink}>Logout</a>
                    <a className={styles.navLink}>{account.userName}</a>
                </span> :
                <button className={styles.buttonLink}>Login</button>
            } */}
        </div>
    )
}
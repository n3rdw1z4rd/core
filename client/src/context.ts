import { Context, createContext } from 'preact';
import { useContext } from 'preact/hooks';

export declare type Account = {
    userName: string,
};

export const AccountContext: Context<Account> = createContext<Account>(null);

export const useAccountContext = () => useContext(AccountContext);
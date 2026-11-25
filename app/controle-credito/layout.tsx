import type {ReactNode} from 'react';
// HTML/RSC must follow the active revision, never the previous cached shell.
export const dynamic='force-dynamic';
export const revalidate=0;
export default function Layout({children}:{children:ReactNode}){return children;}

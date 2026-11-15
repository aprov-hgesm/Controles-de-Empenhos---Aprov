import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './styles.css';
import './features/hospital/integration/hospital-premium.css';

const el=document.getElementById('root');
if(!el)throw Error('Aplicação hospitalar sem ponto de montagem.');
createRoot(el).render(<React.StrictMode><App/></React.StrictMode>);

import {parseLandXML} from './core';
self.onmessage=(event:MessageEvent)=>{const m=event.data;if(m?.type!=='parse')return;try{self.postMessage({type:'parsed',revision:m.revision,routes:parseLandXML(String(m.text),String(m.fileName))});}catch(error){self.postMessage({type:'error',revision:m.revision,message:error instanceof Error?error.message:String(error)});}};

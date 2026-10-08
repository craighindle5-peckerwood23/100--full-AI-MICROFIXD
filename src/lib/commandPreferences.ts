const KEY='microfixd_command_preferences';
export interface CommandPreferences {retrieval:{limit:number;max_chars:number}}
export function getCommandPreferences():CommandPreferences {
  try {
    const value=JSON.parse(localStorage.getItem(KEY)||'null');
    return {retrieval:{limit:[10,30,50,100].includes(value?.retrieval?.limit)?value.retrieval.limit:10,max_chars:[8000,20000,60000,80000,100000].includes(value?.retrieval?.max_chars)?value.retrieval.max_chars:8000}};
  }catch{return {retrieval:{limit:10,max_chars:8000}};}
}
export function saveCommandPreferences(value:CommandPreferences):void {localStorage.setItem(KEY,JSON.stringify(value));}

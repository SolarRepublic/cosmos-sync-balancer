import type {Arrayable} from '@blake.regalia/belt';

import {is_array} from '@blake.regalia/belt';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function aligned(a_strings: TemplateStringsArray, ...a_exprs: (Arrayable<string> | number)[]): string {
	let s_out = '';

	// each string/expr
	for(let i_part=0; i_part<a_strings.length; i_part++) {
		const s_string = a_strings[i_part];
		const z_expr = a_exprs[i_part] || '';

		// append output with string
		s_out += s_string;

		// grab indent of last line
		const s_indent = /(?:^|\n)([ \t]+)$/.exec(s_string)?.[1] || '';

		// propagate indent into expression
		if(is_array(z_expr)) {
			s_out += (z_expr[0] || '')+z_expr.slice(1).map(s => '\n'+s_indent+s).join('');
		}
		else {
			s_out += z_expr;
		}
	}

	return s_out;
}

export const unindent = (s_str: string): string => s_str.split('\n').map(s => '\t'+s.trim()).join('\n');

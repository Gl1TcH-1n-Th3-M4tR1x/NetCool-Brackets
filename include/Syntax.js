define(function (require, exports, module) {
    "use strict";

    // Since brackets 1.4 will enable defineSimpleMode of CodeMirror, and the CodeMirror
    // rust.js is old, I write a new rust.js with defineSimpleMode, this line will be deleted
    // when the new version of brackets or the new version of codemirror release.
  
    CodeMirror.defineMode("netcool_rules", function(config) {
    	var indentUnit = config.indentUnit;

    	var keywords = {
    			"table":true,
    			"break":true,
    			"case":true,
    			"registertarget":true,
    			"array":true,
    			"match":true,
    			"updateload":true,
    			"getload":true,
    			"else":true,
    			"log":true,
    			"for":true,
    			"settarget":true,
    			"go":true,
    			"include":true,
    			"if":true,
    			"import":true,
    			"interface":true,
    			"map":true,
    			"package":true,
    			"range":true,
    			"return":true,
    			"select":true,
    			"struct":true,
    			"switch":true,
    			"type":true,
    			"var":true,
    			"bool":true,
    			"byte":true,
    			"complex64":true,
    			"complex128":true,
    			"float32":true,
    			"float64":true,
    			"int8":true,
    			"int16":true,
	    		"int32":true,
	    		"int64":true,
	    		"string":true,
	    		"uint8":true,
	    		"uint16":true,
	    		"uint32":true,
	    		"uint64":true,
	    		"int":true,
	    		"uint":true,
	    		"uintptr":true
    	};

    	var atoms = {
    			"true":true, "false":true, "iota":true, "nil":true, "append":true,
    			"cap":true, "close":true, "complex":true, "copy":true, "imag":true,
    			"len":true, "make":true, "new":true, "panic":true, "print":true,
    			"println":true, "real":true, "recover":true
    	};

    	var isOperatorChar = /[+\-*&^%:=<>!|\/]/;

    	var curPunc;

    	function tokenBase(stream, state) {
    		var ch = stream.next();
    		if (ch == '"' || ch == "'" || ch == "`") {
    			state.tokenize = tokenString(ch);
    			return state.tokenize(stream, state);
    		}
    		if (ch == "@"){
    			stream.eatWhile(/[\w\$_]/);
    			return "variable-2";
    		}
    
    		if (/[\d\.]/.test(ch)) {
    			if (ch == ".") {
    				stream.match(/^[0-9]+([eE][\-+]?[0-9]+)?/);
    			} else if (ch == "0") {
    				stream.match(/^[xX][0-9a-fA-F]+/) || stream.match(/^0[0-7]+/);
    			} else {
    				stream.match(/^[0-9]*\.?[0-9]*([eE][\-+]?[0-9]+)?/);
    			}
    			return "number";
    		}
    		if (/[\[\]{}\(\),;\:\.]/.test(ch)) {
    			curPunc = ch;
    			return null;
    		}
    		if (ch == "#") {
    			stream.skipToEnd();
    			return "comment";
    		}

    		if (isOperatorChar.test(ch)) {
    			stream.eatWhile(isOperatorChar);
    			return "operator";
    		}
    		stream.eatWhile(/[\w\$_\xa1-\uffff]/);
    		var cur = stream.current();
    		if (keywords.propertyIsEnumerable(cur)) {
    			if (cur == "case" || cur == "default") curPunc = "case";
    			return "keyword";
    		}
    		if (atoms.propertyIsEnumerable(cur)) return "atom";
    		return "variable";
    	}
  
  
    	function tokenString(quote) {
    		return function(stream, state) {
    			var escaped = false, next, end = false;
    			while ((next = stream.next()) != null) {
    				if (next == quote && !escaped) {end = true; break;}
    				escaped = !escaped && quote != "`" && next == "\\";
    			}
    			if (end || !(escaped || quote == "`"))
    				state.tokenize = tokenBase;
    			return "string";
    		};
    	}
  
    	function Context(indented, column, type, align, prev) {
    		this.indented = indented;
    		this.column = column;
    		this.type = type;
    		this.align = align;
    		this.prev = prev;
    	}
    	function pushContext(state, col, type) {
    		return state.context = new Context(state.indented, col, type, null, state.context);
    	}
    	function popContext(state) {
    		if (!state.context.prev) return;
    		var t = state.context.type;
    		if (t == ")" || t == "]" || t == "}")
    			state.indented = state.context.indented;
    		return state.context = state.context.prev;
    	}

    	// Interface

    	return {
    		startState: function(basecolumn) {
    			return {
    				tokenize: null,
    				context: new Context((basecolumn || 0) - indentUnit, 0, "top", false),
    				indented: 0,
    				startOfLine: true
    			};
    		},

    		token: function(stream, state) {
    			var ctx = state.context;
    			if (stream.sol()) {
    				if (ctx.align == null) ctx.align = false;
    				state.indented = stream.indentation();
    				state.startOfLine = true;
    				if (ctx.type == "case") ctx.type = "}";
    			}
    			if (stream.eatSpace()) return null;
    			curPunc = null;
    			var style = (state.tokenize || tokenBase)(stream, state);
    			if (style == "comment") return style;
    			if (ctx.align == null) ctx.align = true;

    			if (curPunc == "{") pushContext(state, stream.column(), "}");
    			else if (curPunc == "[") pushContext(state, stream.column(), "]");
    			else if (curPunc == "(") pushContext(state, stream.column(), ")");
    			else if (curPunc == "case") ctx.type = "case";
    			else if (curPunc == "}" && ctx.type == "}") ctx = popContext(state);
    			else if (curPunc == ctx.type) popContext(state);
    			state.startOfLine = false;
    			return style;
    		},

    		indent: function(state, textAfter) {
    			if (state.tokenize != tokenBase && state.tokenize != null) return 0;
    			var ctx = state.context, firstChar = textAfter && textAfter.charAt(0);
    			if (ctx.type == "case" && /^(?:case|default)\b/.test(textAfter)) {
    				state.context.type = "}";
    				return ctx.indented;
    			}
    			var closing = firstChar == ctx.type;
    			if (ctx.align) return ctx.column + (closing ? 0 : 1);
    			else return ctx.indented + (closing ? 0 : indentUnit);
    		},

    		electricChars: "{}):",
    		fold: "brace",
    		blockCommentStart: "/*",
    		blockCommentEnd: "*/",
    		lineComment: "#"
    	};
    });
});
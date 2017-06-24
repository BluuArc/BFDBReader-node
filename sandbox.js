var client = require('./data_tier_client.js');
var fs = require('fs');

client.setAddress("http://127.0.0.1:8081");

let unit_names = {}, item_names = {};

var BuffProcessor = function(/*unit_names, item_names*/){
    let no_buff_data_msg = "Message length is 0";
    // unit_names = unit_names || {};
    // item_names = item_names || {};
    //helper functions
    function print_effect_legacy(effects) {
        var print_array = function (arr) {
            var text = "[";

            for (var i in arr) {
                if (arr[i] instanceof Array) text += print_array(arr[i]);
                else if (arr[i] instanceof Object) text += JSON.stringify(arr[i]); //most likely a JSON object
                else text += arr[i];

                text += ",";
            }

            if (text.length > 1) {
                text = text.substring(0, text.length - 1); //remove last comma
            }

            text += "]";
            return text;
        }
        var text_arr = [];
        //convert each effect into its own string
        for (var param in effects) {
            if (param !== "passive id" && param !== "effect delay time(ms)\/frame") {
                var tempText = effects[param];
                if (effects[param] instanceof Array) tempText = print_array(effects[param]); //parse array
                else if (effects[param] instanceof Object) tempText = JSON.stringify(effects[param]); //parse JSON object
                text_arr.push("" + param + ": " + tempText);
            }
        }

        //convert array into a single string
        var i = 0;
        var text = "";
        for (i = 0; i < text_arr.length; ++i) {
            text += text_arr[i];
            if (i + 1 != text_arr.length) text += " / ";
        }
        return text + "";
    }

    function to_proper_case(input){
        return `${input[0].toUpperCase()}${input.slice(1).toLowerCase()}`;
    }

    function get_polarized_number(number) {
        if (number < 0) return number.toString();
        else return "+" + number.toString();
    }

    function get_formatted_minmax(min, max) {
        if(min !== max) {
            if(max > 0) return min + "-" + max;
            else        return min + " to " + max;
        }
        else return min || max;
    }

    function multi_param_buff_handler(options) {
        /*
        options = {
            all: array of objects with keys values and name; e.g. {value:50, name: "ATK"}
            values: array of values, can contain indices of undefined
            names: array of names for each value
            special_case: {
                isSpecialCase(value,names_array): given a value or names_array, return a bool for if params are a special case
                func(value,names_array): handle the special case and return a string
            }
            prefix(names_arr) || prefix: if function, return a formatted string for a given array of names
                if string, then this will be inserted before every value listing
            numberFn(number): special function to get a specific formatted string for a value (like returning polarity or percent with number)
            suffix(names_arr) || suffix: if function, return a formatted string for a given array of names
                if string, then this will be appended after joining of names_arr
            buff_separator: separator between buff names, default is "/"
            message_separator: separator between different value strings, default is ", "
        }
        required: all or (values and names), special_case.func if special_case.isSpecialCase() is used
        all else is optional
        */
        if (!options) throw "multi_param_buff_handler: No options defined";
        if (options.all) { //array of objects with keys value and name
            options.values = [];
            options.names = [];
            for (let i = 0; i < options.all.length; ++i) {
                let [curValue, curName] = [options.all[i]["value"], options.all[i]["name"]];
                options.values.push(curValue);
                options.names.push(curName);
            }
        }
        if (!options.values || !options.names) throw "multi_param_buff_handler: No values, names, or all array defined";

        //create a JSON object keyed by buff values
        // console.log(options);
        let common_values = {}, msg = "";
        for (let i = 0; i < options.values.length; ++i) {
            if (options.values[i] !== undefined) { //in case some values are undefined
                let curValue = options.values[i].toString();
                if (!common_values[curValue]) {
                    common_values[curValue] = [];
                };
                //value of each key is an array of names with that shared value
                common_values[curValue].push(options.names[i]);
            }
        }

        // console.log(common_values);

        //create a string from common_values object
        var msg_arr = []; //array of shared values
        for (let v in common_values) {
            let msg = "";
            //handle special cases
            if (options.special_case && options.special_case.isSpecialCase(v, common_values[v])) {
                msg = options.special_case.func(v, common_values[v]);
                if (msg.length > 0) msg_arr.push(msg);
                continue;
            }
            //format output according to options
            if (options.prefix){
                if(typeof options.prefix === "function") msg += options.prefix(common_values[v]);
                else msg += options.prefix;
            }
            if (options.numberFn) msg += options.numberFn(v);
            else msg += v;
            if (typeof options.suffix === "function") msg += options.suffix(common_values[v]);
            else {
                msg += common_values[v].join(options.buff_separator || "/");
                if (typeof options.suffix === "string") msg += options.suffix;
            }
            msg_arr.push(msg);
        }

        let result_msg = "";
        result_msg += msg_arr.join(options.message_separator || ", ");
        return result_msg;
    }
    this.multi_param_buff_handler = multi_param_buff_handler;

    function hp_adr_buff_handler(hp,atk,def,rec, options){
        options = options || {};
        options.all = options.all || [
            {value: hp, name: "HP"},
            {value: atk, name: "ATK"},
            {value: def, name: "DEF"},
            {value: rec, name: "REC"}
        ];

        options.numberFn = options.numberFn || function(number){
            return `${get_polarized_number(number)}% `;
        };

        return multi_param_buff_handler(options);
    }

    function bc_hc_items_handler(bc,hc,item,options){
        options = options || {};
        options.all = [
            { value: bc, name: "BC" },
            { value: hc, name: "HC" },
            { value: item, name: "Item" },
        ];

        options.numberFn = function (number) {
            return `${get_polarized_number(number)}% `;
        };

        return multi_param_buff_handler(options);
    }

    function bb_atk_buff_handler(bb, sbb, ubb, options) {
        options = options || {};
        options.all = options.all || [
            { value: bb, name: "BB" },
            { value: sbb, name: "SBB" },
            { value: ubb, name: "UBB" }
        ];

        options.numberFn = options.numberFn || function (number) {
            return `${get_polarized_number(number)}% `;
        };

        return multi_param_buff_handler(options);
    }

    function variable_elemental_mitigation_handler(effect){
        let elements = ['Fire', 'Water', 'Earth', 'Thunder', 'Light', 'Dark'];
        let buffs = ['mitigate fire attacks (21)', 'mitigate water attacks (22)', 'mitigate earth attacks (23)', 'mitigate thunder attacks (24)', 'mitigate light attacks (25)', 'mitigate dark attacks (26)'];
        let values = [];
        for(let b of buffs){
            values.push(effect[b]);
        }

        let options = {
            names: elements,
            values: values,
            numberFn: function(value) {return `${value}% `;},
            suffix: " mitigation",
            special_case: {
                isSpecialCase: function(val,names) {return names.length >= 4;},
                func: function(value, names){
                    let msg = `${value}% `;
                    if(names.length < 6){
                        for(let n of names){
                            msg += n[0].toUpperCase();
                        }
                    }else{
                        msg += "all elemental";
                    }
                    msg += " mitigation";
                    return msg;
                }
            }
        };

        return multi_param_buff_handler(options);

    }

    function elemental_bool_handler(options){
        options.names = options.names || ['Fire', 'Water', 'Earth', 'Thunder', 'Light', 'Dark'];

        options.numberFn = options.numberFn || function(d) {return "";};

        options.special_case = options.special_case || {
            isSpecialCase: function(value,name_arr) { return value == "true" && name_arr.length === 6;},
            func: function(value,names_array){
                return "all elemental";
            }
        }

        return multi_param_buff_handler(options);
    }

    function ewd_buff_handler(effects) {
        var elements = ['Fire', 'Water', 'Earth', 'Thunder', 'Light', 'Dark'];
        var suffix = " units do extra elemental weakness dmg";
        var found = [];
        var i;
        var msg = get_polarized_number(effects["elemental weakness multiplier%"]) + "% ";
        for (i = 0; i < elements.length; ++i) {
            var curBuff = effects[elements[i].toLowerCase() + suffix];
            if (curBuff) { //add first letter to message
                found.push(elements[i]);
            }
        }

        if (found.length === 0) {
            throw "No EWD buffs found";
        } else if (found.length <= 2) { //only 1 or 2 EWD buffs, so full names are fine
            msg += found[0];
            for (i = 1; i < found.length; ++i) {
                msg += "/" + found[i];
            }
        } else if (found.length === elements.length) { //buff for all elements
            msg += "all elements";
        } else {
            for (i = 0; i < found.length; ++i) { //multiple EWD buffs, so use first letter only
                msg += found[i][0];
            }
        }
        msg += " EWD";

        //format: #% FWETLD EWD
        return msg;
    }

    function ailment_reflect_handler(effects){
        var ailments = ["injury%", "poison%", "sick%", "weaken%", "curse%", "paralysis%"];
        var ailments_full_name = ["counter inflict injury% (81)", "counter inflict poison% (78)", "counter inflict sick% (80)", "counter inflict weaken% (79)", "counter inflict curse% (82)", "counter inflict paralysis% (83)"];
        var values = {};
        var msg = "";
        //sort values by proc chance
        for (var i = 0; i < ailments.length; ++i) {
            var curAilment = effects[ailments_full_name[i]];
            console.log(ailments_full_name[i],curAilment);
            if (curAilment) {
                // console.log(ailments[i], curAilment);
                if (!values[curAilment.toString()]) {
                    values[curAilment.toString()] = [];
                }
                values[curAilment.toString()].push(ailments[i].replace('%', ""));
            }
        }

        // console.log(values);

        for (var a in values) {
            if (msg.length > 0) msg += ", ";

            msg += a + "% chance to inflict ";
            if(values[a].length === ailments.length){
                msg += "any ailment"
            }else{
                for (var ailment = 0; ailment < values[a].length; ++ailment) {
                    msg += values[a][ailment];
                    if (ailment !== values[a].length - 1) {
                        msg += "/";
                    }
                }
            }
        }
        msg += " when hit";
        return msg;
    }

    //give an options object with at least an array of values for each ailment
    function ailment_handler(options){
        if(!options || !options.values) throw "ailment_handler: No options or values defined";
        if(options.values.length === 6)
            options.names = options.names || ["Injury", "Poison", "Sick", "Weaken", "Curse", "Paralysis"];
        else if(options.values.length === 3)
            options.names = options.names || ["ATK Down", "DEF Down", "REC Down"];
        else if(options.values.length === 9)
            options.names = options.names || ["Injury", "Poison", "Sick", "Weaken", "Curse", "Paralysis", "ATK Down", "DEF Down", "REC Down"];

        options.numberFn = options.numberFn || function(value){
            return `${value}%`;
        }

        return multi_param_buff_handler(options);
    }

    function ailments_cured_handler(ailments_array){
        function contains_all_status_ailments(arr){
            var containsAll = true;
            var ailments = ['poison', 'weaken', 'sick', 'injury', 'curse', 'paralysis'];
            for(let a = 0; a < ailments.length; ++a){
                if(arr.indexOf(ailments[a]) === -1){
                    containsAll = false; break;
                }
            }
            return containsAll;
        }

        function contains_all_stat_reductions(arr){
            var containsAll = true;
            var ailments = ['atk down', 'def down', 'rec down'];
            for (let a = 0; a < ailments.length; ++a) {
                if (arr.indexOf(ailments[a]) === -1) {
                    containsAll = false; break;
                }
            }
            return containsAll;
        }

        var msg = "";
        if(ailments_array.length === 9){
            msg += "all ailments";
        }else if(ailments_array.length === 6 && contains_all_status_ailments(ailments_array)){
            msg += "all status ailments";
        }else if(ailments_array.length === 3 && contains_all_stat_reductions(ailments_array)){
            msg += "all status reductions";
        }else{
            msg += ailments_array.join("/");
        }
        return msg;
    }

    function get_duration_and_target(turns, area, type) {
        var msg = "";
        //first param is an effects object
        if ((typeof turns).toLowerCase() === 'object') {
            area = turns["target area"];
            type = turns["target type"];
            turns = turns["buff turns"];
        } else if ((typeof area).toLowerCase() === 'object') {
            type = area["target type"];
            area = area["target area"];
        }
        if(turns) msg += " for " + turns + (turns === 1 ? " turn" : " turns");
        msg += " (" + area + "," + type + ")";
        msg += " duration and target".toUpperCase(); //remove once all buffs stop using this function
        return msg;
    }

    function get_target(area,type,options){
        // console.log("Received target data",area,type);
        if(typeof area === "object" && area["target type"] && area["target area"]){
            type = area["target type"];
            area = area["target area"];
        }else if(typeof type === "object" && type["target type"] && type["target area"]){
            area = type["target area"];
            type = type["target type"];
        }

        options = options || {};
        let prefix = options.prefix || "to ";
        let suffix = options.suffix || "";

        //special case for when options.prefix is ""
        if(typeof options.prefix === "string" && options.prefix.length === 0)
            prefix = "";
        
        if(area === "single" && type === "self"){
            return ` ${prefix}self${suffix}`;
        }else if(area === "aoe" && type === "party"){
            return ` ${prefix}allies${suffix}`;
        }else if(area === "aoe" && type === "enemy"){
            return ` ${prefix}enemies${suffix}`;
        }else if(area === "single" && type === "enemy"){
            return ` ${prefix}an enemy${suffix}`;
        }else if(area === "single" && type === "party"){
            return ` ${prefix}an ally${suffix}`;
        }else{
            return ` (${area},${type})`;
        }
    }

    function get_turns(turns, msg, sp, buff_desc){
        let turnMsg = "";
        if ((msg.length === 0 && sp) || (turns === 0 && !sp) || (turns && sp) || (turns !== undefined && turns !== 0)) {
            if (msg.length === 0 && sp) turnMsg = `Allows current ${buff_desc}${(buff_desc.toLowerCase().indexOf("buff") === -1) ? " buff(s)" : ""} to last for additional `;
            else turnMsg += ` for `;
            turnMsg += `${turns} ${(turns === 1 ? "turn" : "turns")}`;
        }
        return turnMsg;
    }

    function regular_atk_helper(effect){
        let msg = "";
        // if (effect["bb flat atk"]) msg += " (+" + effect["bb flat atk"] + " flat ATK)";
        if (effect["bb bc%"]) msg += ", innate " + get_polarized_number(effect["bb bc%"]) + "% BC drop rate";
        if (effect["bb crit%"]) msg += ", innate " + get_polarized_number(effect["bb crit%"]) + "% crit rate";
        if (effect["bb hc%"]) msg += ", innate " + get_polarized_number(effect["bb hc%"]) + "% HC drop rate";
        return msg;
    }

    var buff_types = {
        attack: `unit attacks enemy`,
        buff: `unit gains some sort of enhancement to their stats or attacks, can last more than one turn`,
        debuff: `unit's attack inflicts some ailment onto the enemy`,
        effect: `buff does something directly to the unit(s) on that turn; multiple instances of itself on the same turn will stack`,
        passive: `always active`,
        timed: `only active for a certain amount of time`,
        none: `buff doesn't do anything; either bugged or developer value`,
        unknown: `it is unknown what buffs of these types do or how to interpret them correctly`
    }; 
    var proc_buffs = {
        '1': {
            desc: "Regular Attack",
            type: ["attack"],
            notes: ["Unless otherwise specified, the attack will always be toward the enemy"],
            func: function(effect,other_data){
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if(!other_data.sp){
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                let damage = [];
                if (effect["bb atk%"]) damage.push(`${effect["bb atk%"]}%`);
                if (effect["bb dmg%"]) damage.push(`${effect["bb dmg%"]}%`); //case when using a burst from bbs.json
                switch(damage.length){
                    case 1: msg += ` ${damage[0]}`; break;
                    case 2: msg += ` ${damage[0]} (${damage[1]} power)`; break;
                    default: break;
                }

                if(!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if(!other_data.sp){
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100) 
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if(extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if(!other_data.sp){
                    if(effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '2': {
            desc: "Burst Heal",
            type: ["effect"],
            notes: ["if no hits are mentioned, then the burst heal happens all at once", "over multiple hits means that for every hit, units heal a fraction of the burst heal"],
            func: function (effect, other_data){
                let damage_frames = other_data.damage_frames || {};
                var msg = get_formatted_minmax(effect['heal low'], effect['heal high']) + " HP burst heal ";
                msg += "(+" + effect['rec added% (from healer)'] + "% healer REC)";
                if (damage_frames.hits > 1)
                    msg += " over " + damage_frames.hits + " hits";
                // msg += " (" + effect["target area"] + "," + effect["target type"] + ")";
                if(!other_data.sp) msg += get_target(effect,other_data);
                return msg;
            }
        },
        '3': {
            desc: "Heal over Time (HoT)",
            type: ["buff"],
            func: function (effect, other_data){
                other_data = other_data || {};
                var msg = "";
                if (effect["gradual heal low"] || effect['gradual heal high']){
                    msg = get_formatted_minmax(effect["gradual heal low"], effect["gradual heal high"]) + " HP HoT";
                    msg += " (+" + effect["rec added% (from target)"] + "% target REC)";
                }

                if(msg.length === 0 && !other_data.sp) throw no_buff_data_msg;

                if(!other_data.sp) msg += get_target(effect, other_data);

                msg += get_turns(effect["gradual heal turns (8)"],msg,other_data.sp,this.desc);

                return msg;
            }
        },
        '4': {
            desc: "BB Gauge Refill",
            type: ["effect"],
            notes: ["This effect is similar to the regular BC insta-fill buff (proc 31), but has the option of filling a percentage of the BB gauge", "Filling 100% of own BB gauge means that the gauge will be refilled to SBB if it's unlocked"],
            func: function (effect,other_data) {
                var msg = "";
                if(effect["bb bc fill%"]){
                    if (effect["bb bc fill%"] !== 100)
                        msg += `${get_polarized_number(effect["bb bc fill%"])}% BB gauge of`;
                    else
                        msg += "Fills BB gauge of";
                }

                if(effect["bb bc fill"]){
                    if (effect["bb bc fill%"]) msg += " and ";
                    msg += `${get_polarized_number(effect["bb bc fill"])} BC fill to`;
                }
                if (!other_data.sp) msg += get_target(effect,other_data,{
                    prefix: ''
                });

                if (effect["bb bc fill%"] === 100){
                    msg += " to max";
                }

                return msg;
            }
        },
        '5': {
            desc: "Regular and Elemental ATK/DEF/REC/Crit Rate",
            type: ["buff"],
            func: function (effect, other_data){
                var msg = "";
                if (effect["atk% buff (1)"] || effect["def% buff (3)"] || effect["rec% buff (5)"]) { //regular tri-stat
                    msg += hp_adr_buff_handler(undefined,effect["atk% buff (1)"], effect["def% buff (3)"], effect["rec% buff (5)"]);
                }
                if (effect["crit% buff (7)"]) {//crit rate buff
                    if (msg.length > 0) msg += ", ";
                    msg += get_polarized_number(effect["crit% buff (7)"]) + "% crit rate";
                }

                if (effect["atk% buff (2)"] || effect["def% buff (4)"] || effect["rec% buff (6)"]) {//decreased buffs
                    if (msg.length > 0) msg += ", ";
                    msg += hp_adr_buff_handler(undefined, effect["atk% buff (2)"], effect["def% buff (4)"], effect["rec% buff (6)"]);
                }

                if (effect["atk% buff (13)"] || effect["def% buff (14)"] || effect["rec% buff (15)"]) { //elemental tri-stat
                    msg += hp_adr_buff_handler(undefined,effect["atk% buff (13)"], effect["def% buff (14)"], effect["rec% buff (15)"]);
                }
                if (effect["crit% buff (16)"]) { //elemental crit buff
                    if (msg.length > 0) msg += ", ";
                    msg += get_polarized_number(effect["crit% buff (16)"]) + "% crit rate";
                }
                if (effect['element buffed'] !== "all") {
                    msg += " of " + to_proper_case(effect['element buffed'] || "null");
                }

                if(msg.length === 0 && !other_data.sp) throw no_buff_data_msg;

                if(!other_data.sp) msg += get_target(effect,other_data);

                msg += get_turns(effect["buff turns"], msg, other_data.sp, this.desc);

                return msg;
            }
        },
        '6': {
            desc: "BC/HC/Item Drop Rate",
            type: ["buff"],
            func: function (effect, other_data) {
                console.log('proc 6',effect);
                var msg = "";
                if (effect["bc drop rate% buff (10)"] || effect["hc drop rate% buff (9)"] || effect["item drop rate% buff (11)"] ) 
                    msg += bc_hc_items_handler(effect["bc drop rate% buff (10)"], effect["hc drop rate% buff (9)"], effect["item drop rate% buff (11)"]) + " droprate";

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;

                if(!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["drop rate buff turns"],msg,other_data.sp,this.desc);

                return msg;
            }
        },
        '7': {
            desc: "Guaranteed Angel Idol (AI)",
            type: ["buff"],
            notes: ["This is the one that is guaranteed to work; no chance of failing", "if you see false in the result, please let the developer (BluuArc) know"],
            func: function (effect, other_data) {
                var info_arr = [];
                if (effect["angel idol buff (12)"] !== true) info_arr.push(effect["angel idol buff (12)"]);
                info_arr.push(`recover ${effect["angel idol recover hp%"] || 100}% HP on use`);
                let msg = `gives Angel Idol (${info_arr.join(", ")})`;
                if (!other_data.sp) msg += get_target(effect, other_data);
                return msg;
            }
        },
        '8': {
            desc: "Increase Max HP",
            type: ["buff"],
            func: function (effects, other_data) {
                let msg = "";
                if (effects["max hp increase"]){
                    msg = `${get_polarized_number(effects["max hp increase"])} HP boost to max HP`;
                }else{
                    msg = `${get_polarized_number(effects["max hp% increase"])}% Max HP`;
                }
                if(!other_data.sp) msg += get_target(effects,other_data);
                return msg;
            }
        },
        '9': {
            desc: "ATK/DEF/REC down to enemy",
            type: ["debuff"],
            notes: ['Not sure if this is implemented properly on SP for unit 30517 or 61027'],
            func: function (effect, other_data) {
                var msg = "";
                let chance, amount; //used to check values for SP
                //case  that both buffs are present with same proc chance
                if (effect['buff #1'] !== undefined && effect['buff #2'] !== undefined && effect['buff #1']['proc chance%'] === effect['buff #2']['proc chance%']){
                    console.log("entered double branch");
                    let debuff1 = effect['buff #1'];
                    let debuff2 = effect['buff #2'];
                    chance = debuff1['proc chance%'];
                    let atk = debuff1['atk% buff (1)'] || debuff2['atk% buff (1)'] || debuff1['atk% buff (2)'] || debuff2['atk% buff (2)'];
                    let def = debuff1['def% buff (3)'] || debuff2['def% buff (3)'] || debuff1['def% buff (4)'] || debuff2['def% buff (4)'] || debuff1['def% buff (14)'] || debuff2['def% buff (14)']; 
                    let rec = debuff1['rec% buff (5)'] || debuff2['rec% buff (5)'] || debuff1['rec% buff (6)'] || debuff2['rec% buff (6)'];
                    amount =  atk || 0 + def || 0 + rec || 0;
                    msg += debuff1['proc chance%'] + "% chance to inflict " + hp_adr_buff_handler(undefined, atk, def, rec); 
                }else if (effect['buff #1']) {
                    let debuff = effect['buff #1'];
                    chance = debuff['proc chance%'];
                    let atk = debuff['atk% buff (1)'] || debuff['atk% buff (2)'];
                    let def = debuff['def% buff (3)'] || debuff['def% buff (4)'] || debuff['def% buff (14)'];
                    let rec = debuff['rec% buff (5)'] || debuff['rec% buff (6)'];
                    amount = atk || 0 + def || 0 + rec || 0;
                    msg += debuff['proc chance%'] + "% chance to inflict " + hp_adr_buff_handler(undefined, atk, def, rec);
                }else if (effect['buff #2']) {
                    if (msg.length > 0) msg += ", ";
                    let debuff = effect['buff #2'];
                    chance = debuff['proc chance%'];
                    let atk = debuff['atk% buff (1)'] || debuff['atk% buff (2)'];
                    let def = debuff['def% buff (3)'] || debuff['def% buff (4)'] || debuff['def% buff (14)'];
                    let rec = debuff['rec% buff (5)'] || debuff['rec% buff (6)'];
                    amount = atk || 0 + def || 0 + rec || 0;
                    msg += debuff['proc chance%'] + "% chance to inflict " + hp_adr_buff_handler(undefined, atk, def, rec);
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if(!chance && !amount && other_data.sp) msg = "";
                msg += get_turns(effect["buff turns"], msg, other_data.sp, this.desc);

                if(effect['element buffed'] !== 'all') msg += ` of ${to_proper_case(effect['element buffed'] || "null")} types`; 
                // msg += ` for ${effect["buff turns"]} ${effect["buff turns"] === 1 ? "turn" : "turns"}`;
                if(!other_data.sp) msg += get_target(effect,other_data);
                return msg;
            }
        },
        '10': {
            desc: "Status Ailment Removal",
            type: ["effect"],
            notes: ["if you see false in the result, please let the developer (BluuArc) know", 'This seems similar to proc 38, the usual status removal buff'],
            func: function(effect,other_data){
                let msg = "Removes all status ailments";
                if (effect["remove all status ailments"] !== true){
                    msg += ` ${effect["remove all status ailments"]}) `;
                }
                if (!other_data.sp) msg += get_target(effect, undefined, {
                    prefix: 'from '
                });
                return msg;
            }
        },
        '11': {
            desc: "Inflict Status Ailment",
            type: ["debuff"],
            notes: ["Some bursts have a 'null' parameter; it's currently unknown as to what it does"],
            func: function (effect, other_data) {
                let options = {};
                options.values = [
                    effect["injury%"],
                    effect["poison%"],
                    effect["sick%"],
                    effect["weaken%"],
                    effect["curse%"],
                    effect["paralysis%"]
                ];

                options.suffix = function(names){
                    if(names.length === 6){
                        return " chance to inflict any status ailment";
                    }else{
                        return ` chance to inflict ${names.join("/")}`;
                    }
                }
                
                let msg = ailment_handler(options);
                if (msg.length === 0 && (!effect[null] || !other_data.sp)) throw no_buff_data_msg;
                
                if (effect[null]) {
                    if(msg.length === 0)
                        msg += `Unknown param 'null' (${effect[null]})`;
                    else 
                        msg += `, Unknown param 'null' (${effect[null]})`;
                }
                if (!other_data.sp) msg += get_target(effect,other_data);
                return msg;
            }
        },
        '12': {
            desc: "Guaranteed Revive",
            type: ["effect"],
            notes: ["As of June 2017, this is only found on at least one NPC attack and some items"],
            func: function (effect, other_data) {
                let revive_target = get_target(effect,other_data,{
                    prefix: "",
                    suffix: ""
                });

                let msg = `revive${revive_target} with ${effect['revive to hp%']}% HP`;
                return msg;
            }
        },
        '13': {
            desc: "Random Target (RT) Attack",
            type: ["attack"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = effect.hits || "NaN";
                // var numHits = effect.hits;
                let msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                if (effect["bb atk%"]) msg += ` ${effect["bb atk%"]}%`;

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if(!other_data.sp){
                    if(effect["random attack"] === false) msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                    else msg += "RT";
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100) 
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '14': {
            desc: "HP Draining Attack",
            type: ["attack"],
            notes: ["Unless otherwise specified, the attack will always be toward the enemy"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                let damage = [];
                if (effect["bb atk%"]) damage.push(`${effect["bb atk%"]}%`);
                if (effect["bb dmg%"]) damage.push(`${effect["bb dmg%"]}%`); //case when using a burst from bbs.json
                switch(damage.length){
                    case 1: msg += ` ${damage[0]}`; break;
                    case 2: msg += ` ${damage[0]} (${damage[1]} power)`; break;
                    default: break;
                }

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                extra.push(`heal ${get_formatted_minmax(effect["hp drain% low"],effect["hp drain% high"])}% of damage dealt`);
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '16': {
            desc: "Elemental Mitigation",
            type: ["buff"],
            notes: ["This is different from proc ID 39 in that each element can have a different value of mitigation; otherwise it's almost the same"],
            func: function (effect, other_data) {
                let msg = variable_elemental_mitigation_handler(effect);
                if (effect['mitigate all attacks (20)'] !== undefined){
                    if(msg.length > 0) msg += ", ";
                    msg += `${effect['mitigate all attacks (20)']}% all attack mitigation`;
                }
                if (!other_data.sp) msg += get_target(effect);
                msg += get_turns(effect['buff turns'],msg,other_data.sp,this.desc);
                return msg;
            }
        },
        '17': {
            desc: "Status Negation/Resistance",
            type: ["buff"],
            func: function (effect, other_data) {
                let options = {};
                options.values = [
                    effect["resist injury% (33)"],
                    effect["resist poison% (30)"],
                    effect["resist sick% (32)"],
                    effect["resist weaken% (31)"],
                    effect["resist curse% (34)"],
                    effect["resist paralysis% (35)"]
                ];

                options.suffix = function (names) {
                    if (names.length === 6) {
                        return " all status ailments";
                    } else {
                        return ` ${names.join("/")}`;
                    }
                };

                options.numberFn = function(value){
                    if(value === 100)
                        return "full resistance to";
                    else 
                        return `${value}% resistance to`;
                };

                options.special_case = {
                    isSpecialCase: function(value,names){
                        // console.log("Received:", value, names.length, value == 100, names.length === 6);
                        return value == 100 && names.length === 6;
                    },
                    func: function(value, names){
                        return "Negates all status ailments";
                    }
                };

                let msg = ailment_handler(options);
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;

                if (!other_data.sp) msg += get_target(effect, other_data,{
                    prefix: 'for '
                });
                msg += get_turns(effect['resist status ails turns'],msg,other_data.sp,this.desc);
                return msg;
            }
        },
        '18': {
            desc: "Mitigation",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if(effect['dmg% reduction']) msg += `${effect["dmg% reduction"]}% mitigation`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if(!other_data.sp) msg += get_target(effect,other_data);
                msg += get_turns(effect['dmg% reduction turns (36)'],msg,other_data.sp,this.desc);
                return msg;
            }  
        },
        '19': {
            desc: "BC Fill per Turn",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if(effect['increase bb gauge gradual']) msg += effect["increase bb gauge gradual"] + " BC/turn";

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect['increase bb gauge gradual turns (37)'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '20': {
            desc: "BC Fill on Hit",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["bc fill when attacked%"] || effect["bc fill when attacked low"] || effect["bc fill when attacked high"]){
                    if (effect["bc fill when attacked%"] !== undefined && effect["bc fill when attacked%"] !== 100){
                        msg += `${effect["bc fill when attacked%"]}% chance to fill `;
                    }else if(effect["bc fill when attacked%"] !== undefined && effect["bc fill when attacked%"] === 100) {
                        msg += "Fills ";
                    }
                    msg +=`${get_formatted_minmax(effect["bc fill when attacked low"],effect["bc fill when attacked high"])} BC when hit`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["bc fill when attacked turns (38)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '22': {
            desc: "Defense Ignore",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect['defense% ignore']) msg += `${effect['defense% ignore']}% DEF ignore`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data,{
                    prefix: "to attacks of "
                });
                msg += get_turns(effect["defense% ignore turns (39)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '23': {
            desc: "Spark Damage",
            type: ["buff"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["spark dmg% buff (40)"]) msg += get_polarized_number(effect["spark dmg% buff (40)"]) + "% spark DMG boost";

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "to attacks of "
                });
                msg += get_turns(effect["buff turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '24': {
            desc: "Stat Conversion",
            type: ["buff"],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['converted attribute'] || effect['atk% buff (46)'] || effect['def% buff (47)'] || effect['rec% buff (48)']){
                    let source_buff = (effect['converted attribute'] !== undefined) ? (effect['converted attribute'] || "null").toUpperCase().slice(0, 3) : undefined;
                    if(source_buff === "ATT") source_buff = "ATK";
                    let options = {
                        suffix: " conversion",
                    };
                    if(source_buff){
                        options.numberFn = function(value) {return `${value}% ${source_buff}->`};
                    }
                    msg = hp_adr_buff_handler(undefined, effect['atk% buff (46)'], effect['def% buff (47)'], effect['rec% buff (48)'], options);
                    // var buff = adr_buff_handler(effect['atk% buff (46)'], effect['def% buff (47)'], effect['rec% buff (48)']);
                    // msg = "Convert " + buff.replace('% ', "% " + source_buff + " to ");
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["% converted turns"], msg, other_data.sp, this.desc);
                // msg += get_duration_and_target(effect["% converted turns"], effect["target area"], effect["target type"]);
                return msg;
            }
        },
        '26': {
            desc: "Hit Count Increase",
            type: ['buff'],
            notes: ['100% damage means that the extra hits have no damage penalty', 'Over 100% damage means that the extra hits have a damage buff', `Under 100% damage means that the extra hits have a damage penalty`, `+# means that the unit has # additional more hits, so +2 means that each hit has 2 more hits following it, effectively tripling the original hit count`],
            func: function(effect,other_data){
                let msg = "";
                if (effect['hit increase/hit'] || effect['extra hits dmg%'])
                    msg += `${get_polarized_number(effect['hit increase/hit'] || 0)} ${(effect['hit increase/hit'] === 1) ? "hit" : "hits"} to normal attacks (at ${(100 + (effect['extra hits dmg%'] || 0))}% damage)`;
                
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect["hit increase buff turns (50)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '27': {
            desc: "HP% Damage Attack",
            type: ['attack'],
            func: function(effect,other_data){
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                if (effect["bb atk%"]) msg += ` ${effect["bb atk%"]}%`;

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (effect['hp% damage high'] || effect['hp% damage low'] || effect['hp% damage chance%']){
                    extra.push(`${effect['hp% damage chance%']}% chance to deal ${get_formatted_minmax(effect['hp% damage low'], effect['hp% damage high'])}% of target's max HP`);
                }
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '28': {
            desc: "Fixed Damage Attack",
            type: ['attack'],
            func: function(effect, other_data){
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                }
                if (effect["fixed damage"] !== undefined) msg += `fixed ${effect["fixed damage"]} damage `;

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '29': {
            desc: "Multi-Elemental Attack",
            notes: ["These elements are added onto the attack of the unit's base element"],
            type: ["attack"],
            func: function (effect, other_data) {
                other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                let damage = [];
                if (effect["bb atk%"]) damage.push(`${effect["bb atk%"]}%`);
                if (effect["bb dmg%"]) damage.push(`${effect["bb dmg%"]}%`); //case when using a burst from bbs.json
                switch(damage.length){
                    case 1: msg += ` ${damage[0]}`; break;
                    case 2: msg += ` ${damage[0]} (${damage[1]} power)`; break;
                    default: break;
                }

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if(effect['bb elements']){
                    let elements = effect['bb elements'].map(function(e) {return to_proper_case(e || "null")});
                    msg += elements.join("/") + " ";
                }

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '30': {
            desc: "Elemental Buffs",
            type: ["buff"],
            notes: ["FWETLD corresponds to fire, water, earth, thunder, light, and dark, respectively"],
            func: function (effect, other_data) {
                let msg = "";
                if (effect['elements added'] && effect['elements added'].length > 0) {
                    let elements = effect['elements added'].map(function(v) {return v ? to_proper_case(v) : "Null";});
                    msg += "Add ";
                    if (elements.length < 3){
                        msg += elements.join("/");
                    } else if (elements.length < 6){
                        msg += elements.map(function(v) {return v[0].toUpperCase();}).join("");
                    }else{
                        msg += "all elements";
                    }
                    msg += " to attacks";
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect["elements added turns"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '31': {
            desc: "BC Insta-fill/Flat BB Gauge Increase",
            type: ["effect"],
            func: function (effect, other_data) {
                var msg = ""
                if (effect["increase bb gauge"] !== undefined) msg += `${get_polarized_number(effect["increase bb gauge"])} BC fill`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                // msg += get_duration_and_target(undefined, effect['target area'], effect['target type']);
                return msg;
            }
        },
        '32': {
            desc: "Change Base Element",
            type: ['buff'],
            notes: ['This is first seen with Grah\'s attacks in Trial 2'],
            func: function(effect,other_data){
                let msg = "";
                if(effect['set attack element attribute']){
                    msg += `Change base element`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                if (effect['set attack element attribute']) {
                    msg += ` to ${to_proper_case(effect['set attack element attribute'])}`;
                }
                return msg;
            }
        },
        '33': {
            desc: "Buff Wipe/Buff Removal",
            type: ['debuff'],
            func: function(effect,other_data){
                let msg = "";
                if (effect['clear buff chance%'] !== undefined){
                    msg += `${effect['clear buff chance%']}% chance to remove buffs`;
                }
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                return msg;
            }
        },
        '34': {
            desc: "BB Gauge Reduction",
            type: ['debuff'],
            func: function(effect,other_data){
                let msg = "";
                let reductions = [];
                if (effect['base bb gauge reduction low'] || effect['base bb gauge reduction high'])
                    reductions.push(`${get_formatted_minmax(effect['base bb gauge reduction low'],effect['base bb gauge reduction high'])} BC`);
                if (effect['bb gauge% reduction low'] || effect['bb gauge% reduction high'])
                    reductions.push(`${get_formatted_minmax(effect['bb gauge% reduction low'],effect['bb gauge% reduction high'])}%`);
                if (effect['bb gauge reduction chance%'] !== undefined && reductions.length > 0){
                    msg += `${effect['bb gauge reduction chance%']}% chance to reduce BB gauge`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });

                if (effect['bb gauge reduction chance%'] !== undefined && reductions.length > 0) {
                    msg += ` by ${reductions.join(" and ")}`;
                }
                return msg;
            }
        },
        '36': {
            desc: "LS Lock",
            type: ['debuff'],
            func: function(effect,other_data){
                let msg = "";
                if (effect['invalidate LS chance%'] !== undefined){
                    msg += `${effect['invalidate LS chance%']}% chance to nullify LS effects`;
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect["invalidate LS turns (60)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '38': {
            desc: "Status Cleanse (Ailments and/or Stat Reductions)",
            notes: ["Status ailments refers to the basic 6 paralysis,injury,etc.", "Stat reductions refer to ATK/DEF/REC down", "Ailments refers to both status ailments and stat reductions"],
            type: ["effect"],
            func: function (effect, other_data) {
                var msg = "";
                if (effect["ailments cured"]) msg += `Clears ${ailments_cured_handler(effect["ailments cured"])}`;
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "inflicted on "
                });
                // msg += get_duration_and_target(undefined,effect["target area"], effect["target type"]);
                return msg;
            }
        },
        '39': {
            desc: "Elemental Mitigation",
            type: ["buff"],
            notes: ["This is different from proc ID 16 in that there's one mitigation value for the given elements; otherwise it's almost the same"],
            func: function (effect, other_data) {
                let msg = "";
                let options = {
                    values: [
                        effect['mitigate fire attacks'],
                        effect['mitigate water attacks'],
                        effect['mitigate earth attacks'],
                        effect['mitigate thunder attacks'],
                        effect['mitigate light attacks'],
                        effect['mitigate dark attacks'],
                    ]
                };

                let any_element = effect['mitigate fire attacks'] || effect['mitigate water attacks'] || effect['mitigate earth attacks'] || effect['mitigate thunder attacks'] || effect['mitigate light attacks'] || effect['mitigate dark attacks'];
                // if (effect['dmg% mitigation for elemental attacks'] || any_element){
                    if (effect['dmg% mitigation for elemental attacks'])
                        msg += `${effect['dmg% mitigation for elemental attacks']}% elemental mitigation`;
                    if(any_element){
                        msg += ` from ${elemental_bool_handler(options)} attacks`;
                    }
                // }

                if (!other_data.sp) msg += get_target(effect);
                msg += get_turns(effect['dmg% mitigation for elemental attacks buff turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '40': {
            desc: "Status Ailment Inflict When Attacking",
            type: ["buff"],
            func: function (effect, other_data) {
                let msg = "";
                let options = {};
                options.values = [
                    effect["injury% buff"],
                    effect["poison% buff"],
                    effect["sick% buff"],
                    effect["weaken% buff"],
                    effect["curse% buff"],
                    effect["paralysis% buff"]
                ];

                options.suffix = function (names) {
                    if (names.length === 6) {
                        return " chance to inflict any status ailment";
                    } else {
                        return ` chance to inflict ${names.join("/")}`;
                    }
                }

                let ails = ailment_handler(options);
                if(ails.length > 0) msg += `Adds ${ails} to attacks`;
                if (msg.length === 0 && (!effect[null] || !other_data.sp)) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                msg += get_turns(effect['buff turns'], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '43': {
            desc: "Burst OD Fill",
            type: ["effect"],
            notes: ["I'm inferring that target type 4 implies the player's OD gauge"],
            func: function (effect, other_data) {
                var msg = ""
                if (effect["increase od gauge%"]) msg +=`${get_polarized_number(effect["increase od gauge%"])}% OD gauge fill`;
                if (msg.length === 0 && (!effect[null] || !other_data.sp)) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data, {
                    prefix: "of "
                });
                if(msg.indexOf("(single,4)") > -1) msg = msg.replace("(single,4)", "of player");
                return msg;
            }
        },
        '44': {
            desc: "Damage Over Time (DoT)",
            notes: ["unit 720176 has some weird values with this ID"],
            type: ["debuff"],
            func: function (effect, other_data) {
                let msg = "";
                let values = [];
                if(effect["dot atk%"] !== undefined)
                    msg += effect["dot atk%"] + "% DoT";
                if (effect['dot flat atk'])
                    values.push(get_polarized_number(effect["dot flat atk"]) + " flat ATK");
                if (effect['dot dmg%'])
                    values.push(get_polarized_number(effect['dot dmg%']) + "% multiplier");
                
                if(values.length > 0){
                    msg += ` (${values.join(", ")})`;
                }
                
                if (effect['dot element affected'] === false) {
                    msg += " (EWD doesn't apply)";
                }

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["dot turns (71)"], msg, other_data.sp, this.desc);
                return msg;
            }
        },
        '45': {
            desc: "BB/SBB/UBB ATK",
            type: ["buff"],
            func: function (effect, other_data) {
                let msg = "";
                if (effect["bb atk% buff"] || effect["sbb atk% buff"] || effect["ubb atk% buff"])
                    msg += bb_atk_buff_handler(effect["bb atk% buff"], effect["sbb atk% buff"], effect["ubb atk% buff"], {
                        suffix: " ATK"
                    });

                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp) msg += get_target(effect, other_data);
                msg += get_turns(effect["buff turns (72)"], msg, other_data.sp, this.desc);

                // msg += get_duration_and_target(effect["buff turns (72)"], effect["target area"], effect["target type"]);
                return msg;
            }
        },
        '47': {
            desc: "HP Scaling Attack",
            type: ["attack"],
            func: function (effect, other_data) {
               other_data = other_data || {};
                let damage_frames = other_data.damage_frames || {};
                var numHits = damage_frames.hits || "NaN";
                var max_total = (+effect["bb base atk%"] || 0) + (+effect["bb added atk% based on hp"] || 0);
                var msg = "";
                if (!other_data.sp) {
                    msg += numHits.toString() + ((numHits === 1) ? " hit" : " hits");
                }
                if (effect["bb base atk%"] || effect["bb added atk% based on hp"]){
                    if (effect["bb base atk%"] !== max_total)
                        msg += ` ${get_formatted_minmax(effect["bb base atk%"] || 0, max_total)}%`;
                    else   
                        msg += ` ${max_total}-${max_total}%`;
                }

                if (!other_data.sp) msg += " ";
                else msg += " to BB ATK%";

                if (!other_data.sp) {
                    msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                }
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (damage_frames["hit dmg% distribution (total)"] !== undefined && damage_frames["hit dmg% distribution (total)"] !== 100)
                    extra.push(`at ${damage_frames["hit dmg% distribution (total)"]}% power`);
                if (effect['bb added atk% proportional to hp']) extra.push(`proportional to ${effect['bb added atk% proportional to hp']} HP`);
                if (extra.length > 0) msg += ` (${extra.join(", ")})`;

                msg += regular_atk_helper(effect);

                if (!other_data.sp) {
                    if (effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
                }
                return msg;
            }
        },
        '53': {
            desc: "Ailment Reflect",
            type: ["buff"],
            func: function (effects, other_data) {
                var msg = ailment_reflect_handler(effects);
                msg += get_duration_and_target(effects["counter inflict ailment turns"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '54': {
            desc: "Critical Hit Damage",
            type: ["buff"],
            func: function (effects, other_data) {
                var msg = get_polarized_number(effects["crit multiplier%"]) + "% crit DMG";

                msg += get_duration_and_target(effects["buff turns (84)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '55': {
            desc: "Elemental Weakness Damage (EWD)",
            notes: ["FWETLD corresponds to fire, water, earth, thunder, light, and dark, respectively"],
            type: ["buff"],
            func: function (effects, other_data) {
                var msg = ewd_buff_handler(effects);
                if (msg.length === 0) {
                    throw no_buff_data_msg;
                }
                msg += get_duration_and_target(effects["elemental weakness buff turns"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '56': {
            desc: "Chance Angel Idol (AI)",
            notes: ["This buff cannot be buff wiped"],
            type: ["buff"],
            func: function (effects, other_data) {
                var msg = "gives " + effects["angel idol recover chance%"] + "% chance Angel Idol";
                if (effects["angel idol recover hp%"]) msg += " (recovers " + effects["angel idol recover hp%"] + "% HP on proc)";

                msg += get_duration_and_target(effects["angel idol buff turns (91)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '58': {
            desc: "Spark Vulnerability to Enemy",
            type: ["debuff"],
            func: function (effects, other_data) {
                var msg = `${effects["spark dmg received apply%"]}% chance to inflict ${parseInt(effects["spark dmg received debuff turns (94)"])+1} turn ${get_polarized_number(effects["spark dmg% received"])}% Spark vulnerability debuff`;
                msg += get_duration_and_target(undefined, effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '62': {
            desc: "Elemental Barrier",
            type: ["buff"],
            notes: ["This buff cannot be buff wiped", "Unless otherwise specified, assume that the barrier has 100% DMG absorption"],
            func: function (effects, other_data) {
                var msg = `${effects["elemental barrier hp"]} HP (${effects["elemental barrier def"]} DEF`;
                if(effects["elemental barrier absorb dmg%"] != 100){
                    msg += `/${effects["elemental barrier absorb dmg%"]}% DMG absorption`;
                }
                msg += `) ${effects["elemental barrier element"]} barrier`;
                msg += get_duration_and_target(effects);
                return msg;
            }
        },
        '64': {
            desc: "Consective Use Boosting Attack",
            type: ["attack"],
            notes: ["This refers to attacks whose power increases on consecutive use"],
            func: function (effects, other_data) {
                var numHits = damage_frames.hits;
                var max_total = parseInt(effects["bb base atk%"]) + parseInt(effects["bb atk% inc per use"]) * parseInt(effects["bb atk% max number of inc"]);
                var msg = numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                // msg += effects["bb atk%"] + "% ";
                msg += `${get_formatted_minmax(effects["bb base atk%"], max_total)}% `;
                msg += (effects["target area"].toUpperCase() === "SINGLE") ? "ST" : effects["target area"].toUpperCase();
                if (effects["bb flat atk"]) msg += ` (+${effects["bb atk% inc per use"]}%/use, max ${effects["bb atk% max number of inc"]} uses, +` + effects["bb flat atk"] + " flat ATK)";
                else msg += ` (+${effects["bb atk% inc per use"]}%/use, max ${effects["bb atk% max number of inc"]} uses)`;
                if (effects["bb bc%"]) msg += ", innate +" + effects["bb bc%"] + "% BC drop rate";
                return msg;
            }
        },
        '65': {
            desc: "Damage Boost to Status Afflicted Foes",
            type: ["buff"],
            func: function (effects, other_data) {
                var msg = `${get_polarized_number(effects["atk% buff when enemy has ailment"])}% ATK to status afflicted foes`;
                msg += get_duration_and_target(effects["atk% buff turns (110)"],effects);
                return msg;
            }
        },
        '66': {
            desc: "Chance Revive",
            type: ["effect"],
            func: function (effects, other_data) {
                var msg = `${effects["revive unit chance%"]}% chance to revive allies with ${effects["revive unit hp%"]}% HP`;
                msg += ` (${effects["target area"]},${effects["target type"]})`
                return msg;
            }
        },
        '67': {
            desc: "BC Fill on Spark",
            type: ["buff"],
            func: function (effects, other_data) {
                var msg = `${effects["bc fill on spark%"]}% chance to fill ${get_formatted_minmax(effects["bc fill on spark low"], effects["bc fill on spark high"])} BC on spark`;
                msg += get_duration_and_target(effects["bc fill on spark buff turns (111)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '78': {
            desc: "Self ATK/DEF/REC/Crit Rate",
            notes: ["Stacks with the regular party ATK/DEF/REC/Crit Rate buff", "Example of a unit having both party and self is Silvie (840128)"],
            type: ["buff"],
            func: function (effects, other_data) {
                var msg = "";
                if (effects["self atk% buff"] || effects["self def% buff"] || effects["self rec% buff"]) { //regular tri-stat
                    msg += adr_buff_handler(effects["self atk% buff"], effects["self def% buff"], effects["self rec% buff"]);
                }
                if (effects["self crit% buff"]) {//crit rate buff
                    if (msg.length > 0) msg += ", ";
                    msg += "+" + effects["self crit% buff"] + "% crit rate";
                }

                if (msg.length === 0) {
                    throw no_buff_data_msg;
                }
                //insert own into message
                if(effects["target area"] === 'single' && effects["target type"] === "self"){
                        while(msg.indexOf("% ") > -1){
                            msg = msg.replace("% ", "# own ");
                        }
                        while(msg.indexOf("# ") > -1){
                            msg = msg.replace("# ", "% ");
                        }
                        msg += ` for ${effects["self stat buff turns"]} turns`;
                }else{
                    msg += get_duration_and_target(effects["self stat buff turns"], effects["target area"], effects["target type"]);
                }
                return msg;
            }
        },
        '83': {
            desc: "Spark Critical",
            type: ["buff"],
            func: function (effects, other_data) {
                var msg = `${effects["spark dmg inc chance%"]}% chance for a ${get_polarized_number(effects["spark dmg inc% buff"])}% spark critical`;
                msg += get_duration_and_target(effects["spark dmg inc buff turns (131)"], effects);
                return msg;
            }
        },
        '84': {
            desc: "OD Fill Rate",
            type: ["buff"],
            func: function (effects, other_data) {
                var msg = `${get_polarized_number(effects["od fill rate% buff"])}% OD gauge fill rate`;
                msg += get_duration_and_target(effects["od fill rate buff turns (132)"], effects);
                return msg;
            }
        },
        '85': {
            desc: "Heal on Hit",
            type: ["buff"],
            func: function (effects, other_data) {
                var msg = effects["hp recover from dmg chance"] + "% chance to heal ";
                msg += get_formatted_minmax(effects["hp recover from dmg% low"], effects["hp recover from dmg% high"]) + "% DMG when hit";

                msg += get_duration_and_target(effects["hp recover from dmg buff turns (133)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '88': {
            desc: "Spark Damage (Self)",
            type: ["buff"],
            notes: ["Should stack with other spark buffs (such as 23)"],
            func: function (effects, other_data) {
                var msg = get_polarized_number(effects["spark dmg inc%"]);
                
                if(effects["target area"] === "single" && effects["target type"] === "self"){
                    msg += `% own spark DMG for ${effects["spark dmg inc% turns (136)"]} turns`;
                }else{
                    msg += `% spark DMG${get_duration_and_target(effects["spark dmg inc% turns (136)"],effects)}`;
                }
                return msg;
            }
        },
    };//end proc_buffs

    //general handler for all unknown procs
    function unknown_proc_handler(effect,other_data){
        let msg = "";
        if (effect['unknown proc param']) msg += `Unknown proc effects {${effect['unknown proc param']}}`;
        if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
        if (!other_data.sp) msg += get_target(effect, other_data);
        return msg;
    }

    function unknown_proc_attack_handler(effect,other_data){
        other_data = other_data || {};
        let damage_frames = other_data.damage_frames || {};
        var numHits = damage_frames.hits || "NaN";
        var msg = `${numHits} hit attack (?)`;
        if (effect['unknown proc param'])
            msg += `, unknown proc effects {${effect['unknown proc param']}}`;
        if (!other_data.sp) msg += get_target(effect, other_data);
        return msg;
    }

    var unknown_proc_buffs = {
        '': {
            desc: "Damage over Time (EU Version?)",
            type: ['debuff','unknown'],
            notes: ['This is first found on the SBB for 720236', 'Values for this aren\'t fully known, just guessed based on the numbers', 'It uses the interpreter for proc 44 to generate the description'],
            func: function(effect,other_data){
                let data = effect['unknown proc param'].split(',');
                // console.log(data);
                if (data.length === 6) { //fix for bb 730236 by adding missing index (?) parameter
                    data = data.slice(0,2).concat([0]).concat(data.slice(2));
                }
                // console.log(data);
                let proc_44 = {
                    'dot atk%': parseInt(data[0]),
                    'dot flat atk': parseInt(data[1]),
                    'dot unit index': parseInt(data[2]),
                    'dot dmg%': parseInt(data[3]),
                    'dot element affected': data[4] == 1,
                    'dot turns (71)': parseInt(data[5]),
                    'unknown proc param6': data[6],
                    'target area': effect['target area'],
                    'target type': effect['target type'],
                    'proc id': 44
                };
                return proc_buffs['44'].func(proc_44,other_data);
            }
        },
        '0': {
            desc: "None",
            type: ["none"],
            notes: ["First found on item 800104"],
            func: function (effect) {
                return "No effect";
            }
        },
        '2-5': {
            desc: "Greatly replenishes a Unit's HP & boosts DEF and REC for 2 turns",
            type: ["effect"],
            notes: ["First found on item Nian Gao (800305)"],
            func: function (effect, other_data) {
                let params = effect["unknown proc param"].split(",");
                // let params = effect["unknown proc param"].split("-");
                // let params2 = params[0].split(","), params5 = params[1].split(",");
                // let proc2 = {
                //     "heal low": params2[0],
                //     "heal high": params2[1],
                //     "rec added% (from healer)": params[2],
                //     "target area": (params2[3] === 0) ? "single" : "aoe",
                //     "target type": (params2[3] === 0) ? "self" : "party"
                // };
                // let proc5 = {

                // }
                let [min_heal,max_heal,def,rec,turns] = [params[0],params[1],params[5],params[6],params[8]];
                let msg = `${get_formatted_minmax(min_heal,max_heal)} HP burst heal and ${adr_buff_handler(undefined,def,rec)} for ${turns} turns`;
                msg += get_target(other_data);
                return msg;
            }
        },
        '27 ': {
            desc: "Unknown values",
            type: ["unknown"],
            notes: ["Note that this is unknown proc '27 ', and not '27'", "This is only found on BB 70640027"],
            func: function(effect,other_data){
                return unknown_proc_handler(effect,other_data);
            }
        },
        '37': {
            desc: "Add a Unit to Battle",
            type: ['effect','unknown'],
            notes: ['Not much is known about this except that it adds a unit to the field', 'This is first found on BB 3181'],
            func: function(effect,other_data){
                let msg = "";
                if(effect['unknown proc param'])
                    msg +=`Adds a unit to the battle`;
                
                if (msg.length === 0 && !other_data.sp) throw no_buff_data_msg;
                if (!other_data.sp){
                    switch(effect['target type']){
                        case "self": msg += " on own side"; break;
                        case "enemy": msg += " on enemy's side"; break;
                        case "party": msg += " on ally's side"; break;
                    }
                }

                if (effect['unknown proc param'])
                    msg += `. Unknown params {${effect['unknown proc param']}}`;

                return msg;
            }
        },
        '42': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['This is first found on BB 3000655'],
            func: function(effect,other_data){
                return unknown_proc_attack_handler(effect,other_data);
            }
        },
        '46': {
            desc: "Unknown attack",
            type: ['attack', 'unknown'],
            notes: ['This is first found on BB 2002561'],
            func: function(effect,other_data){
                return unknown_proc_attack_handler(effect,other_data);
            }
        },
        '48': {
            desc: "Unknown attack",
            type: ['attack', 'unknown'],
            notes: ['This is first found on BB 310990'],
            func: function (effect, other_data) {
                return unknown_proc_attack_handler(effect,other_data);
            }
        },
        '49': {
            desc: "Unknown values",
            type: ['unknown'],
            notes: ['This is first found on BB 3669'],
            func: function (effect, other_data) {
                return unknown_proc_handler(effect,other_data);
            }
        },
    };

    //get names of IDs in array
    function get_names(arr,type){
        let names = [];
        if(type === 'unit'){
            for(let val of arr){
                val = val.toString();
                // console.log(val,unit_names[val]);
                names.push(unit_names[val] || val);
            }
        }else if(type === 'item'){
            for(let val of arr){
                val = val.toString();
                // console.log(val,item_names[val]);
                names.push(item_names[val] || val);
            }
        }
        return names;
    }

    var passive_buffs = {
        '66': {
            desc: "Add effect to BB/SBB",
            type: ["passive"],
            func: function (effect,other_data) {
                let burst_type = (function(bb,sbb, ubb){
                    let options = {
                        all: [
                            {name: "BB", value: bb},
                            {name: "SBB", value: sbb},
                            {name: "UBB", value: ubb}
                        ],
                        numberFn: function(value){return "";}
                    };
                    
                    return multi_param_buff_handler(options);
                })(effect["trigger on bb"], effect["trigger on sbb"], effect["trigger on ubb"]);

                let conditions = {
                    unit: [],
                    item: []   
                };
                if(effect['conditions'] && effect['conditions'].length > 0){
                    for(let condition of effect['conditions']){
                        if (condition['item required'] && condition['item required'].length > 0){
                            for(let item of condition['item required']){
                                if(conditions.item.indexOf(item) === -1){
                                    conditions.item.push(item);
                                }
                            }
                        } else if (condition['unit required'] && condition['unit required'].length > 0){
                            // conditions.push({ type: 'unit', value: condition['unit required'] });
                            for(let unit of condition['unit required']){
                                if(conditions.unit.indexOf(unit) === -1){
                                    conditions.unit.push(unit);
                                }
                            }
                        }
                    }
                }

                // console.log(conditions);

                let buff = [];
                for (let e of effect['triggered effect']){
                    buff.push(print_buff(e));
                }

                let msg = "";
                let cond_msg = [];
                if(conditions.unit.length > 0){
                    let names = get_names(conditions.unit,'unit');
                    if(conditions.unit.length === 1){
                        cond_msg.push(`${names[0]} is in squad`);
                    }else{
                        cond_msg.push(`${names.join(" or ")} are in squad`);
                    }
                }
                if(conditions.item.length > 0){
                    let names = get_names(conditions.item, 'item');
                    if(conditions.item.length === 1){
                        cond_msg.push(`${names[0]} is equipped`);
                    }else{
                        cond_msg.push(`${names.join(" or ")} are equipped`);
                    }
                }
                if(cond_msg.length > 0){
                    msg += `If ${cond_msg.join(" or ")}, then `;
                }

                msg += `${msg.length > 0 ? "add" : "Add"} "${buff.join(" / ").trim()}" to ${burst_type}`;
                if (effect['passive target'] !== undefined && effect['passive target'] !== 'self')
                    msg += ` to ${effect['passive target']}`;
                return msg;
            }
        },
    };

    var unknown_passive_buffs = {

    };

    var unknown_buffs = {

    }

    var buff_list = {
        proc: proc_buffs,
        unknown_proc: unknown_proc_buffs,
        passive: passive_buffs,
        unknown_passive: unknown_passive_buffs,
        unknown_buff: unknown_buffs
    }

    //effects - regular effects object with buff ID and other related buff info
    //other_data - other data needed to print effects, if any
    //type - one of the keys in buff_list
    function general_handler(effects, other_data, type){
        other_data = other_data || {};
        let handler = buff_list[type.replace(" ","_")], id = effects[`${type} id`];
        if(!handler || id === undefined){
            if(!id) console.log("Couldn't find ID in", type);
            return `Unknown buff type "${type}"`;
        }

        try{
            let msg = `Received ${type} id ${id} `;
            if(handler[id]){
                msg += `${handler[id].desc}`;
                if(handler[id].notes) msg += "\n  " + handler[id].notes.join(" / ");
                console.log(msg);

                return handler[id].func(effects, other_data) +  ` [${id}]`;
            }else{
                console.log(msg);
                return `${to_proper_case(type)} ID ${id} is not supported yet`;
            }
        }catch(err){
            console.log(`Error at ${to_proper_case(type)} ${id} =>`,err);
            if(err === no_buff_data_msg)
                return `No valid data found for ${to_proper_case(type)} ID ${id} (${handler[id].desc})`;
            else 
                return `${to_proper_case(type)} ID ${id} has an error`;
        }
    }

    //given an effects object, print get its effects
    function print_buff(effect, other_data) {
        var msg = "";
        // console.log("Received " + effects);
        if (effect["proc id"] !== undefined) {
            msg = general_handler(effect,other_data,"proc");
        } else if (effect["passive id"] !== undefined) {
            msg = general_handler(effect, other_data, "passive");
        } else if (effect["unknown proc id"] !== undefined) {
            msg = general_handler(effect, other_data, "unknown proc");
        } else if (effect["unknown passive id"] !== undefined) {
            msg = general_handler(effect, other_data, "unknown passive");
        } else if (effect["unknown buff id"] !== undefined) {
            msg = general_handler(effect, other_data, "unknown buff");
        } else {
            console.log("Unknown effect object. Using legacy printer.");
            msg = print_effect_legacy(effect);
        }
        return msg;
    }

    this.print_buff = print_buff;
    this.buff_list = buff_list;
};

// var buff_processor = new BuffProcessor();

function UnitEffectPrinter(unit){
    const buff_processor = new BuffProcessor();

    //arr - array of effects
    //other_data_function - given an index, return the data for the other_data field, if any
    //returns a string of translated buffs
    function process_effects(effects,other_data_function){
        let translated_buffs = [];
        let other_data;
        console.log("UnitEffectPrinter.process_effects: Received effects =>",effects);
        if (other_data_function) console.log("UnitEffectPrinter.process_effects: Other data looks like =>",other_data_function(0))
        for(let e = 0; e < effects.length; ++e){
            if(other_data_function) other_data = other_data_function(e);
            let msg = buff_processor.print_buff(effects[e], other_data);
            if(translated_buffs.indexOf(msg) === -1) translated_buffs.push(msg);
            else console.log("ignored duplicate msg:", msg);
        }
        return translated_buffs.join(" / ");
    }
    this.process_effects = process_effects;
    //burst_type - bb, sbb, or ubb
    function printBurst(burst_type){
        console.log("UnitEffectPrinter.printBurst: received",burst_type);
        let burst_object ;
        if(typeof burst_type === "string"){
            if(!unit) throw "No unit specified";
            burst_object = unit[burst_type];
        }else if(typeof burst_type === "object")
            burst_object = burst_type;
        else
            throw `Unknown input for burst_type ${burst_type}`;
        if(!burst_object) return `No ${burst_type.toUpperCase()} data found`;
        let numLevels = burst_object.levels.length, burst_effects = burst_object.levels[numLevels - 1].effects;
        if(burst_object.desc) console.log(burst_object.desc);
        return process_effects(burst_effects,function(i){
            return {
                damage_frames: burst_object["damage frames"][i],
                element: unit.element
            }
        });
    }
    this.printBurst = printBurst;

    function printLS(){
        if (!unit) throw "No unit specified";
        let ls_object = unit["leader skill"];
        if(!ls_object) return `No Leader Skill data found`;
        return process_effects(ls_object.effects);
    }
    this.printLS = printLS;

    //can specify a specifc ES object from es.json
    function printES(es_object){
        if(!es_object){
            if (!unit) throw "No unit specified";
            es_object = unit["extra skill"];
            if(!es_object) return `No Extra Skill data found`;
        }

        console.log(JSON.stringify(es_object,null,2));
        return process_effects(es_object.effects);
    }
    this.printES = printES;

    function printSingleSP(skill_index){
        let skill_obj;
        if(typeof skill_index ==="object"){
            skill_obj =  skill_index;
        }else{
            if (!unit) throw "No unit specified";
            if(unit.skills) skill_obj = unit.skills[skill_index];
        }

        if(!skill_obj) return "No SP data found";
        let skill_arr = skill_obj.skill.effects;

        //SP types: [ 'passive','add to ubb','add to bb','add to sbb','add to passive']
        let sp_effects = {
            'passive': [],
            'add to passive': [],
            'add to bb': [],
            'add to sbb': [],
            'add to ubb': [],
        }

        //put effects in sp_effect object
        for(let f = 0; f < skill_arr.length; ++f){
            let effect = skill_arr[f];
            for(let e in effect){
                if(sp_effects[e]){
                    sp_effects[e].push(effect[e]);
                }else{
                    console.log("Unknown SP effect type", e);
                }
            }
        }

        //translate each effect
        let keys = Object.keys(sp_effects);
        for(let f in sp_effects){
            let curEffects = sp_effects[f];
            if(curEffects.length > 0){
                let msg_arr = process_effects(curEffects,function(){
                    return {
                        sp: true
                    }
                });
                sp_effects[f] = msg_arr;
            }else{
                delete sp_effects[f];
            }
        }

        //concatenate similar strings
        let msg = buff_processor.multi_param_buff_handler({
            values: [sp_effects['add to bb'], sp_effects['add to sbb'], sp_effects['add to ubb'], sp_effects['add to passive']],
            names: ['BB', 'SBB', 'UBB', 'ES'],
            prefix: function(arr){
                return `Enhances ${arr.join("/")} with additional "`
            },
            suffix: function(arr){
                return '"';
            }

        });

        if(sp_effects.passive){
            if(msg.length > 0){
                msg += ", "
            }
            msg += sp_effects.passive;
        }

        return {
            desc: skill_obj.skill.desc,
            translation: msg
        };
        
        // console.log(sp_effects);
    }
    this.printSingleSP = printSingleSP;

    function printSP(){
        if (!unit) throw "No unit specified";
        let enhancements = unit.skills;
        if(!enhancements) return ["No SP Enhancements found"];
        console.log(JSON.stringify(enhancements,null,2));
        let msg_arr = [];
        for(let e = 0; e < enhancements.length; ++e){
            let curMsg = printSingleSP(enhancements[e]);
            msg_arr.push(curMsg);
        }
        return msg_arr;
    }
    this.printSP = printSP;
}

function printESObject(es_object){
    let printES = new UnitEffectPrinter({}).printES;
    return printES(es_object);
}

function printItem(item){
    let process_effects = new UnitEffectPrinter({}).process_effects;
    var effects = item.effect.effect || item.effect;
    return process_effects(effects,function(){
        return {
            "target area": item.effect.target_area,
            "target type": item.effect.target_type
        }
    });
}



//apply a function to all DBs
//func params: server name, db name
function applyToAllDB(func){
    let db_types = ['bbs', 'es', 'feskills', 'info', 'items', 'ls'];
    let servers = ['gl', 'eu', 'jp'];
    for (let s = 0; s < servers.length; ++s) {
        for (let d = 0; d < db_types.length; ++d) {
            func(servers[s],db_types[d]);
        }
    }
}

//scan all files and get buff data
function getBuffDataForAll() {
    var BuffScraper = function () {
        var result_obj;
        //object_id: ID of unit/item
        //cur_object: object currently being analyzed
        //acc_object: object to store all the data (pass in result_obj)
        //object_type: unit or item
        function getBuffData(object_id, cur_object, acc_object, object_type) {
            function addObjectToAccumulator(object_id, cur_object, index_object, object_type) {
                let gray_listed = ["hit dmg% distribution", "frame times"];
                let black_listed = ['proc id', 'passive id']; //prevent duplicate info`
                let type_value = `${object_type}_value`;
                let type_id = `${object_type}_id`;
                //for every field in cur_object
                for (let f in cur_object) {
                    if (black_listed.indexOf(f) > -1) continue; //ignore blacklisted fields

                    //if if doesn't exist, make it
                    if (index_object[f] === undefined) {
                        index_object[f] = {}
                    }

                    //if unit or item array doesn't exist, create it
                    //e.g. if index_object is result_object.proc["proc_id_1"], then format is
                    //result_object.proc["proc_id_1"][f]["unit" or "item"] = {
                    //  values:[], id: []
                    //}

                    //if it's not a graylisted type
                    if (gray_listed.indexOf(f) === -1) {
                        if (index_object[f][type_value] === undefined) {
                            index_object[f][type_value] = {};
                        }
                        let field_value = (function (value) {
                            if (typeof value === "object" || value instanceof Array) {
                                return JSON.stringify(value);
                            } else if (typeof value !== "string") {
                                return value.toString();
                            } else {
                                return value;
                            }
                        })(cur_object[f]);
                        //if there's a unique value, add it to the index_object
                        // if (index_object[f][object_type].values.indexOf(field_value) === -1 && index_object[f][object_type].id.indexOf(object_id) === -1) {
                        //     index_object[f][object_type].values.push(field_value);
                        //     index_object[f][object_type].id.push(object_id);
                        // }
                        if (index_object[f][type_value][field_value] === undefined) {
                            index_object[f][type_value][field_value] = object_id;
                        }
                    } else { //add to the IDs list if length is less than 5 and object_id is not in list yet
                        if (index_object[f][type_id] === undefined) {
                            index_object[f][type_id] = [];
                        }
                        if (index_object[f][type_id].length < 5 && index_object[f][type_id].indexOf(object_id) === -1) {
                            index_object[f][type_id].push(object_id);
                        }

                    }
                }
                return;
            }
            //for every field in the object
            for (let i in cur_object) {
                //look for ID field in cur_object, then push cur_object if ID field exists
                if (typeof cur_object[i] !== "object") {
                    //check for presence of IDs
                    let unique_index = "", property_type = "";
                    var known_id_fields = ['id', 'guide_id', 'raid', 'invalidate LS chance%', 'invalidate LS turns (60)'];
                    if (i.indexOf("unknown passive id") > -1) {
                        property_type = "passive";
                        unique_index = "unknown_passive_id_" + cur_object[i];
                    } else if (i.indexOf("passive id") > -1) {
                        property_type = "passive";
                        unique_index = "passive_id_" + cur_object[i];
                    } else if (i.indexOf("unknown proc id") > -1) {
                        property_type = "proc";
                        unique_index = "unknown_proc_id_" + cur_object[i];
                    } else if (i.indexOf("proc id") > -1) {
                        property_type = "proc";
                        unique_index = "proc_id_" + cur_object[i];
                    } else if (i.indexOf("unknown buff id") > -1) {
                        property_type = "buff";
                        unique_index = "unknown_buff_id_" + cur_object[i];
                    } else if (i.indexOf("buff id") > -1) {
                        property_type = "buff";
                        unique_index = "buff_id_" + cur_object[i];
                    } else if (i.indexOf("id") > -1 && known_id_fields.indexOf(i) === -1 && i.indexOf("angel idol") === -1) { //print out any missing ID field names
                        console.log(i);
                    }

                    //add current ID to list of property_type is found
                    if (property_type.length > 0) {
                        //create index if it doesn't exist yet
                        if (acc_object[property_type][unique_index] === undefined) {
                            acc_object[property_type][unique_index] = {}
                        }

                        //add cur_object's keys, values, and ID to acc_object
                        addObjectToAccumulator(object_id, cur_object, acc_object[property_type][unique_index], object_type);
                    }
                } else {
                    //recursively look for data
                    if (typeof cur_object[i] === "object") {
                        getBuffData(object_id, cur_object[i], acc_object, object_type);
                    } else if (cur_object[i] instanceof Array) {//traverse the array in reverse order
                        let length = cur_object[i].length;
                        for (let l = length - 1; l >= 0; --l) {
                            getBuffData(object_id, cur_object[i][l], acc_object, object_type);
                        }
                    }
                }
            }
        }
        this.getBuffData = getBuffData;

        //array of objects where each index has two keys
        //name and db
        function getBuffDataForAllinDB(database, database_name) {
            if (result_obj === undefined) {
                result_obj = {
                    passive: {},
                    proc: {},
                    buff: {}
                };
            }

            //get buff data of all units
            for (let id in database) {
                getBuffData(id, database[id], result_obj, database_name);
            }


            // fs.writeFileSync("./test_buff_id.json", JSON.stringify(result_obj, null, "\t"));
            // return result_obj;
        }
        this.getBuffDataForAllinDB = getBuffDataForAllinDB;

        this.getResult = function () {
            //sort each object in result_obj
            let fields = Object.keys(result_obj);
            for (let f = 0; f < fields.length; ++f) {
                var sort_arr = [];
                //put everything into an array
                for (let id_field in result_obj[fields[f]]) {
                    sort_arr.push({
                        prefix: id_field.split("id_")[0],
                        id: id_field.split("id_")[1],
                        data: result_obj[fields[f]][id_field]
                    });
                }
                //sort in ascending order
                sort_arr.sort(function (a, b) {
                    let idA, idB;
                    try {
                        idA = parseInt(a.id);
                    } catch (err) {
                        //erroneous data should go at beginning of array
                        return -1;
                    }

                    try {
                        idB = parseInt(b.id);
                    } catch (err) {
                        //b is erroneous, so a should go after it
                        return 1;
                    }

                    //default sort in ascending order
                    return idA - idB;
                });

                //replace with sorted field
                result_obj[fields[f]] = {};
                for (let i = 0; i < sort_arr.length; ++i) {
                    result_obj[fields[f]][`${sort_arr[i].prefix}id_${sort_arr[i].id}`] = sort_arr[i].data;
                }
            }
            return result_obj;
        }

    }
    let buff_scraper = new BuffScraper();
    applyToAllDB(function(server,db_type){
        console.log(`Scraping ${db_type}-${server}.json`);
        let db = JSON.parse(fs.readFileSync(`./sandbox_data/${db_type}-${server}.json`, 'utf8'));
        buff_scraper.getBuffDataForAllinDB(db, db_type);
    });

    var result = buff_scraper.getResult();
    for (let f in result) {
        let filename = `./full_${f}_id.json`;
        console.log("Saving", filename)
        fs.writeFileSync(filename, JSON.stringify(result[f], null, 4));
    }

    console.log("done");
}

function doItemTest(itemQuery){
    return client.searchItem(itemQuery)
        .then(function(results){
            if(results.length === 1){
                // console.log(results);
                // return client.getItem(result[0]);
                return client.getItem(results[0]).then(function(item){
                    let msg = printItem(item);
                    console.log(JSON.stringify(item, null, 2));
                    console.log(item.name,item.id,"-",item.desc);
                    return msg;
                });
            }else{
                return results;
            }
        })
        .then(function (result) {
            console.log(result);
            // console.log(result.recipe.materials);
        })
        .catch(console.log);
}

function doUnitTest(unitQuery){
    let type = unitQuery.type;
    let burstType = unitQuery.burstType;
    delete unitQuery.type; delete unitQuery.burstType;
    return client.searchUnit(unitQuery)
        .then(function (result) {
            if(result.length === 1){
                return client.getUnit(result[0]).then(function(unit){
                    let unit_printer = new UnitEffectPrinter(unit);
                    let msg;
                    if(type === "burst")
                        msg = unit_printer.printBurst(burstType);
                    else if(type === "sp")
                        msg = unit_printer.printSP();
                    else if(type === "es")
                        msg = unit_printer.printES();

                    if (unit.translated_name) console.log(unit.translated_name);
                    console.log(unit.name, unit.id);
                    // console.log(JSON.stringify(unit, null, 2));
                    return msg;
                });
            }else{
                return result;
            }
        })
        .then(function(result){
            // console.log(result);
            // console.log(result.split('\n\n'));
            // console.log(result.length,result);
            if(result instanceof Array){
                if(result.length === 0) console.log("No result found");
                result.forEach(function(elem,index){
                    if(elem.desc && elem.translation){ //SP
                        console.log(index.toString(),elem.desc,"\n ",elem.translation);
                    }else{
                        console.log(index,elem);
                    }
                });
            }else{
                console.log(result);
            }
            // console.log(JSON.stringify(buff_processor.proc_buffs,null,2));
        })
        .catch(console.log);
}

function doBurstTest(id){
    var bursts = {};
    let printBurst = new UnitEffectPrinter({}).printBurst;
    let servers = ['gl','eu','jp'];
    while(!bursts[id] && servers.length > 0){
        let server = servers.shift();
        console.log(`checking ${server}`);
        bursts = JSON.parse(fs.readFileSync(`./sandbox_data/bbs-${server}.json`, 'utf8'));
    }

    // let id = "3116";
    let burst_object = bursts[id];
    console.log(JSON.stringify(burst_object,null,2));
    if(burst_object){
        let msg = printBurst(burst_object);
        console.log(burst_object.name);
        console.log(msg);
    } else 
        console.log("No burst found with ID",id);
}

function doESTest(id){
    var es_db = {};
    let servers = ['gl', 'eu', 'jp'];
    while (!es_db[id] && servers.length > 0) {
        let server = servers.shift();
        console.log(`checking ${server}`);
        es_db = JSON.parse(fs.readFileSync(`./sandbox_data/es-${server}.json`, 'utf8'));
    }
    let es_object = es_db[id];
    console.log(JSON.stringify(es_object,null,2));
    if(es_object){
        let msg = printESObject(es_object);
        console.log(es_object.name, "-", es_object.desc);
        console.log("target:",es_object.target);
        console.log(msg);
    }else{
        console.log("No ES found with ID", id);
    }
}

function sandbox_function(){
    let db = JSON.parse(fs.readFileSync(`./sandbox_data/feskills-gl.json`, 'utf8'));
    let unit = db['40897'];
    let skill = unit.skills[8];
    let msg = new UnitEffectPrinter({}).printSingleSP(skill);
    console.log(msg);
}

function setNameArrays(){
    let units = client.searchUnit({unit_name_id: ""});
    let items = client.searchItem({item_name_id: ""});
    return Promise.all([units,items])
        .then(function(results){
            let unitIDs = results[0];
            let itemIDs = results[1];

            let promises = [];
            let itemCount = 0, unitCount = 0;
            for(let unit of unitIDs){
                // console.log(unit);
                let curUnitPromise = client.getUnit(unit).then(function (unitResult) {
                    // console.log("Got unit", ++unitCount, "/", unitIDs.length);
                    unit_names[unitResult.id.toString()] = (unitResult.translated_name || unitResult.name) + ` (${unitResult.id})`;
                    return;
                });
                promises.push(curUnitPromise);
            }
            for(let item of itemIDs){
                // console.log(item);
                let curItemPromise = client.getItem(item).then(function (itemResult) {
                    // console.log("Got item", ++itemCount, "/", itemIDs.length);
                    item_names[itemResult.id.toString()] = (itemResult.translated_name || itemResult.name) + ` (${itemResult.id})`;
                    return;
                });
                promises.push(curItemPromise);
            }

            return Promise.all(promises);
        }).then(function(){
            // console.log(unit_names);
            // console.log(item_names);
            let names = {
                unit: unit_names,
                item: item_names
            };
            fs.writeFileSync('./names.json', JSON.stringify(names), 'utf8');
            console.log("Wrote names.json");
        });
}

let loadPromise;
try{
    if(fs.existsSync('./names.json')){
        let names = JSON.parse(fs.readFileSync('./names.json'));
        unit_names = names.unit;
        item_names = names.item;
        loadPromise = Promise.resolve();
    }else{
        throw "No names.json found";
    }
}catch(err){
    loadPromise = setNameArrays();
}
loadPromise.then(function(){ 
    return (
        // sandbox_function()
        // getBuffDataForAll()
        // doItemTest({ item_name_id: "22420", verbose: true})
        // doUnitTest({ unit_name_id: "rize",rarity:8,server:'jp',strict: "false", verbose:true,burstType: "sbb", type: "burst"})
        doBurstTest("706209")
        // doESTest("3500")
    );
}).then(function(){
    console.log(" ")  
});
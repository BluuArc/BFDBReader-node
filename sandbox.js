var client = require('./data_tier_client.js');
var fs = require('fs');

client.setAddress("http://127.0.0.1:8081");

var BuffProcessor = function(){
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
        return min + "-" + max;
    }

    function adr_buff_handler(atk, def, rec) {
        var msg = "";
        if (atk && def && rec) {
            if (atk === def) {
                if (atk === rec) { //equal tri-stat
                    msg = get_polarized_number(atk) + "% ATK/DEF/REC";
                } else {//eq atk and def, but not rec
                    msg = get_polarized_number(atk) + "% ATK/DEF, " + get_polarized_number(rec) + "% REC";
                }
            } else if (atk === rec) { //eq atk and rec, but not def
                msg = get_polarized_number(atk) + "% ATK/REC, " + get_polarized_number(def) + "% DEF";
            } else if (def === rec) { //eq def and rec, but not rec
                msg = get_polarized_number(def) + "% DEF/REC, " + get_polarized_number(atk) + "% ATK";
            } else { //all unequal
                msg = get_polarized_number(atk) + "% ATK, " + get_polarized_number(def) + "% DEF, " + get_polarized_number(rec) + "% REC";
            }
        } else if (atk && def) {
            if (atk === def) {
                msg = get_polarized_number(atk) + "% ATK/DEF";
            } else {
                msg = get_polarized_number(atk) + "% ATK, " + get_polarized_number(def) + "% DEF";
            }
        } else if (atk && rec) {
            if (atk === rec) {
                msg = get_polarized_number(atk) + "% ATK/REC";
            } else {
                msg = get_polarized_number(atk) + "% ATK, " + get_polarized_number(rec) + "% REC";
            }
        } else if (def && rec) {
            if (def === rec) {
                msg = get_polarized_number(def) + "% DEF/REC";
            } else {
                msg = get_polarized_number(def) + "% DEF, " + get_polarized_number(rec) + "% REC";
            }
        } else if (atk) {
            msg = get_polarized_number(atk) + "% ATK";
        } else if (def) {
            msg = get_polarized_number(def) + "% DEF";
        } else if (rec) {
            msg = get_polarized_number(rec) + "% REC";
        }
        if (msg.length === 0) {
            console.log("Missed a combo of atk,def,rec (" + atk + "," + def + "," + rec);
        }
        return msg;
    }

    function bb_atk_buff_handler(bb, sbb, ubb) {
        var msg = "";
        if (bb && sbb && ubb) {
            if (bb === sbb) {
                if (bb === ubb) { //equal tri-stat
                    msg = get_polarized_number(bb) + "% BB/SBB/UBB";
                } else { //eq bb and sbb, but not ubb
                    msg = get_polarized_number(bb) + "% BB/SBB, " + get_polarized_number(ubb) + "% UBB";
                }
            } else if (bb === ubb) { //eq bb and ubb, but not sbb
                msg = get_polarized_number(bb) + "% BB/UBB, " + get_polarized_number(sbb) + "% SBB";
            } else if (sbb === ubb) { //eq sbb and ubb, but not ubb
                msg = get_polarized_number(sbb) + "% SBB/UBB, " + get_polarized_number(bb) + "% BB";
            } else { //all unequal
                msg = get_polarized_number(bb) + "% BB, " + get_polarized_number(sbb) + "% SBB, " +
                    get_polarized_number(ubb) + "% UBB";
            }
        } else if (bb && sbb) {
            if (bb === sbb) {
                msg = get_polarized_number(bb) + "% BB/SBB";
            } else {
                msg = get_polarized_number(bb) + "% BB, " + get_polarized_number(sbb) + "% SBB";
            }
        } else if (bb && ubb) {
            if (bb === ubb) {
                msg = get_polarized_number(bb) + "% BB/UBB";
            } else {
                msg = get_polarized_number(bb) + "% BB, " + get_polarized_number(ubb) + "% UBB";
            }
        } else if (sbb && ubb) {
            if (sbb === ubb) {
                msg = get_polarized_number(sbb) + "% SBB/UBB";
            } else {
                msg = get_polarized_number(sbb) + "% SBB, " + get_polarized_number(ubb) + "% UBB";
            }
        } else if (bb) {
            msg = get_polarized_number(bb) + "% BB";
        } else if (sbb) {
            msg = get_polarized_number(sbb) + "% SBB";
        } else if (ubb) {
            msg = get_polarized_number(ubb) + "% UBB";
        }
        if (msg.length === 0) {
            console.log("Missed a combo of bb,sbb,ubb (" + bb + "," + sbb + "," + ubb);
        } else {
            msg += " ATK";
        }
        return msg;
    }

    function elemental_buff_handler(effects){
        var msg = "Add ";
        var length = effects["elements added"].length;
        if(length < 6){
            msg += to_proper_case(effects["elements added"][0]);
            for(var i = 1; i < length; ++i){
                msg += "/" + to_proper_case(effects["elements added"][i]);
            }
        }else{
            msg += "all";
        }
        msg += ` ${(length === 1) ? "element" : "elements"} to attacks`;
        return msg;
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

    function ailment_buff_handler(effects) {
        var ailments = ["injury%", "poison%", "sick%", "weaken%", "curse%", "paralysis%"];
        var values = {};
        var msg = "";
        //sort values by proc chance
        for (var i = 0; i < ailments.length; ++i) {
            var curAilment = effects[ailments[i] + " buff"];
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
            else msg += "Adds ";

            msg += a + "% chance to inflict ";
            for (var ailment = 0; ailment < values[a].length; ++ailment) {
                msg += values[a][ailment];
                if (ailment !== values[a].length - 1) {
                    msg += "/";
                }
            }
        }
        msg += " to all attacks";
        return msg;
    }

    function ailment_inflict_handler(effects) {
        var ailments = ["injury%", "poison%", "sick%", "weaken%", "curse%", "paralysis%"];
        var values = {};
        var msg = "";
        //sort values by proc chance
        for (var i = 0; i < ailments.length; ++i) {
            var curAilment = effects[ailments[i]];
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
            for (var ailment = 0; ailment < values[a].length; ++ailment) {
                msg += values[a][ailment];
                if (ailment !== values[a].length - 1) {
                    msg += "/";
                }
            }
        }
        return msg;
    }

    function ailments_cured_handler(ailments_array){
        function contains_all_status_ailments(arr){
            var containsAll = true;
            var ailments = ['poison', 'weaken', 'sick', 'injury', 'curse', 'paralysis'];
            for(let a = 0; a < ailments.length; ++a){
                if(arr.indexOf(ailments[i]) === -1){
                    containsAll = false; break;
                }
            }
            return containsAll;
        }

        function contains_all_stat_reductions(arr){
            var containsAll = true;
            var ailments = ['atk down', 'def down', 'rec down'];
            for (let a = 0; a < ailments.length; ++a) {
                if (arr.indexOf(ailments[i]) === -1) {
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

    function ailment_null_handler(effects) {
        var ailments = ["injury%", "poison%", "sick%", "weaken%", "curse%", "paralysis%"];
        var ailments_full_name = ["resist injury% (33)", "resist poison% (30)", "resist sick% (32)", "resist weaken% (31)", "resist curse% (34)", "resist paralysis% (35)"];
        var values = {};
        var msg = "";
        //sort values by proc chance
        for (var i = 0; i < ailments.length; ++i) {
            var curAilment = effects[ailments_full_name[i]];
            console.log(ailments_full_name[i], curAilment);
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

            if(a === '100'){
                msg += "Negates ";
            }else{
                msg += a + "% chance to resist ";
            }
            if (values[a].length === ailments.length) {
                msg += "all status ailments"
            } else {
                for (var ailment = 0; ailment < values[a].length; ++ailment) {
                    msg += values[a][ailment];
                    if (ailment !== values[a].length - 1) {
                        msg += "/";
                    }
                }
            }
        }
        return msg;
    }

    function bc_hc_items_handler(bc,hc,item){
        var msg = "";
        if (bc && hc && item) {
            if (bc === hc) {
                if (bc === item) { //equal tri-stat
                    msg = get_polarized_number(bc) + "% BC/HC/Item";
                } else {//eq bc and hc, but not item
                    msg = get_polarized_number(bc) + "% BC/HC, " + get_polarized_number(item) + "% Item";
                }
            } else if (bc === item) { //eq bc and item, but not hc
                msg = get_polarized_number(bc) + "% BC/Item, " + get_polarized_number(hc) + "% HC";
            } else if (hc === item) { //eq hc and item, but not item
                msg = get_polarized_number(hc) + "% HC/Item, " + get_polarized_number(bc) + "% BC";
            } else { //all unequal
                msg = get_polarized_number(bc) + "% BC, " + get_polarized_number(hc) + "% HC, " + get_polarized_number(item) + "% Item";
            }
        } else if (bc && hc) {
            if (bc === hc) {
                msg = get_polarized_number(bc) + "% BC/HC";
            } else {
                msg = get_polarized_number(bc) + "% BC, " + get_polarized_number(hc) + "% HC";
            }
        } else if (bc && item) {
            if (bc === item) {
                msg = get_polarized_number(bc) + "% BC/Item";
            } else {
                msg = get_polarized_number(bc) + "% BC, " + get_polarized_number(item) + "% Item";
            }
        } else if (hc && item) {
            if (hc === item) {
                msg = get_polarized_number(hc) + "% HC/Item";
            } else {
                msg = get_polarized_number(hc) + "% HC, " + get_polarized_number(item) + "% Item";
            }
        } else if (bc) {
            msg = get_polarized_number(bc) + "% BC";
        } else if (hc) {
            msg = get_polarized_number(hc) + "% HC";
        } else if (item) {
            msg = get_polarized_number(item) + "% Item";
        }
        if (msg.length === 0) {
            console.log("Missed a combo of bc,hc,item (" + bc + "," + hc + "," + item);
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
        return msg;
    }

    function get_target(area,type){
        if(typeof area === "object"){
            type = area["target type"];
            area = area["target area"];
        }

        if(area === "single" && type === "self"){
            return " to self";
        }else if(area === "aoe" && type === "party"){
            return " to allies";
        }else if(area === "aoe" && type === "enemy"){
            return " to enemies";
        }else if(area === "single" && type === "enemy"){
            return " to an enemy";
        }else if(area === "single" && type === "party"){
            return " to an ally";
        }else{
            return ` (${area},${type})`;
        }
    }

    function regular_atk_helper(effect){
        let msg = "";
        // if (effect["bb flat atk"]) msg += " (+" + effect["bb flat atk"] + " flat ATK)";
        if (effect["bb bc%"]) msg += ", innate +" + effect["bb bc%"] + "% BC drop rate";
        if (effect["bb crit%"]) msg += ", innate +" + effect["bb crit%"] + "% crit rate";
        if (effect["bb hc%"]) msg += ", innate +" + effect["bb hc%"] + "% HC drop rate";
        return msg;
    }

    var buff_types = {
        attack: `unit attacks enemy`,
        buff: `unit gains some sort of enhancement to their stats or attacks, can last more than one turn`,
        debuff: `unit's attack inflicts some ailment onto the enemy`,
        effect: `buff does something directly to the unit(s) on that turn; multiple instances of itself on the same turn will stack`,
        none: `buff doesn't do anything; either bugged or developer value`
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
                var msg = numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                if (effect["bb dmg%"]) msg += effect["bb dmg%"] + "% "; //case when using a burst from bbs.json
                else msg += effect["bb atk%"] + "% ";
                msg += (effect["target area"].toUpperCase() === "SINGLE") ? "ST" : effect["target area"].toUpperCase();
                let extra = [];
                if (effect["bb flat atk"]) extra.push("+" + effect["bb flat atk"] + " flat ATK");
                if (effect["hit dmg% distribution (total)"] && effect["hit dmg% distribution (total)"] !== 100) extra.push(`at ${effect["hit dmg% distribution (total)"]}% power`);
               if(extra.length > 0) msg += ` (${extra.join(", ")})`;
                msg += regular_atk_helper(effect);

                if(effect["target type"] !== "enemy") msg += ` to ${effect["target type"]}`;
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
                msg += get_target(effect);
                return msg;
            }
        },
        '3': {
            desc: "Heal over Time (HoT)",
            type: ["buff"],
            func: function (effect, other_data){
                other_data = other_data || {};
                var msg = get_formatted_minmax(effect["gradual heal low"], effect["gradual heal high"]) + " HP HoT";
                msg += " (+" + effect["rec added% (from target)"] + "% target REC)";
                msg += ` for ${effect["gradual heal turns (8)"]} ${(effect["gradual heal turns (8)"] === 1 ? "turn" : "turns")}`;

                if(effect["target area"] && effect["target type"]) msg += get_target(effect);
                else msg += get_target(other_data);
                return msg;
            }
        },
        '4': {
            desc: "BB Gauge Refill",
            type: ["effect"],
            notes: ["This effect is similar to the regular BC insta-fill buff (proc 31), but has the option of filling a percentage of the BB gauge", "Filling 100% of own BB gauge meanse that the gauge will be refilled to SBB if it's unlocked"],
            func: function (effects, damage_frames, base_element) {
                var msg = "Fills ";
                if(effects["bb bc fill%"]){
                    msg += `${effects["bb bc fill%"]}%`;
                }

                if(effects["bb bc fill"]){
                    if (effects["bb bc fill%"]) msg += " and ";
                    msg += `${effects["bb bc fill"]} BC`;
                }

                if(effects["target area"] === "single" && effects["target type"] === "self")
                    msg += " of own BB gauge";
                else
                    msg += get_duration_and_target(undefined, effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '5': {
            desc: "Regular and Elemental ATK/DEF/REC/Crit Rate",
            type: ["buff"],
            func: function (effects, damage_frames, base_element){
                var msg = "";
                if (effects["atk% buff (1)"] || effects["def% buff (3)"] || effects["rec% buff (5)"]) { //regular tri-stat
                    msg += adr_buff_handler(effects["atk% buff (1)"], effects["def% buff (3)"], effects["rec% buff (5)"]);
                }
                if (effects["crit% buff (7)"]) {//crit rate buff
                    if (msg.length > 0) msg += ", ";
                    msg += "+" + effects["crit% buff (7)"] + "% crit rate";
                }

                if (effects["def% buff (4)"]) {//decreased def buff (EU)
                    if (msg.length > 0) msg += ", ";
                    msg += (effects["def% buff (4)"] < 0 ? effects["def% buff (4)"] : ("+" + effects["def% buff (4)"])) + "% DEF";
                }

                if (effects["atk% buff (13)"] || effects["def% buff (14)"] || effects["rec% buff (15)"]) { //elemental tri-stat
                    msg += adr_buff_handler(effects["atk% buff (13)"], effects["def% buff (14)"], effects["rec% buff (15)"]);
                }
                if (effects["crit% buff (16)"]) { //elemental crit buff
                    if (msg.length > 0) msg += ", ";
                    msg += "+" + effects["crit% buff (16)"] + "% crit rate";
                }
                if (effects['element buffed'] !== "all") {
                    msg += " to " + effects['element buffed'];
                }
                if (msg.length === 0) {
                    throw "Message length is 0";
                }
                msg += get_duration_and_target(effects);
                return msg;
            }
        },
        '6': {
            desc: "BC/HC/Item Drop Rate",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = bc_hc_items_handler(effects["bc drop rate% buff (10)"], effects["hc drop rate% buff (9)"], effects["item drop rate% buff (11)"]) + " droprate";
                msg += get_duration_and_target(effects["drop rate buff turns"],effects);
                return msg;
            }
        },
        '8': {
            desc: "Increase Max HP",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = `+${effects["max hp% increase"]}% Max HP`;
                msg += get_duration_and_target(effects);
                return msg;
            }
        },
        '9': {
            desc: "ATK/DEF down to enemy",
            type: ["debuff"],
            func: function (effects, damage_frames, base_element) {
                var msg = "";
                if (effects['buff #1']) {
                    var atk_debuff = effects['buff #1'];
                    msg += atk_debuff['proc chance%'] + "% chance for " + get_polarized_number(atk_debuff['atk% buff (2)']) + "% ATK";
                }
                if (effects['buff #2']) {
                    if (msg.length > 0) msg += ", ";
                    var def_debuff = effects['buff #2'];
                    msg += def_debuff['proc chance%'] + "% chance for " + get_polarized_number(def_debuff['def% buff (4)']) + "% DEF";
                }
                if (msg.length === 0) {
                    throw "Message length is 0";
                }
                msg += get_duration_and_target(effects);
                return msg;
            }
        },
        '11': {
            desc: "Inflict Ailment on Enemy",
            type: ["debuff"],
            func: function (effects, damage_frames, base_element) {
                var msg = ailment_inflict_handler(effects);
                if (msg.length === 0) throw "Message length is 0";
                return msg;
            }
        },
        '13': {
            desc: "Random Target (RT) Attack",
            type: ["attack"],
            func: function (effects, damage_frames, base_element) {
                var numHits = effects.hits;
                var msg = numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                msg += effects["bb atk%"] + "% ";
                if(effects["random attack"] === false) msg += (effects["target area"].toUpperCase() === "SINGLE") ? "ST" : effects["target area"].toUpperCase();
                else msg += "RT";
                if (effects["bb flat atk"]) msg += " (+" + effects["bb flat atk"] + " flat ATK)";
                if (effects["bb bc%"]) msg += ", innate +" + effects["bb bc%"] + "% BC drop rate";
                if (effects["bb crit%"]) msg += ", innate +" + effects["bb crit%"] + "% crit rate";
                if (effects["bb hc%"]) msg += ", innate +" + effects["bb hc%"] + "% HC drop rate";
                return msg;
            }
        },
        '17': {
            desc: "Status Negation/Resistance",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = ailment_null_handler(effects);
                msg += get_duration_and_target(effects["resist status ails turns"], effects);
                return msg;
            }
        },
        '18': {
            desc: "Mitigation",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = `${effects["dmg% reduction"]}% mitigation`;
                msg += get_duration_and_target(effects["dmg% reduction turns (36)"], effects["target area"], effects["target type"]);
                return msg;
            }  
        },
        '19': {
            desc: "BC Fill per Turn",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = effects["increase bb gauge gradual"] + " BC/turn";

                msg += get_duration_and_target(effects["increase bb gauge gradual turns (37)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '20': {
            desc: "BC Fill on Hit",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = `${effects["bc fill when attacked%"]}% chance to fill ${get_formatted_minmax(effects["bc fill when attacked low"],effects["bc fill when attacked high"])} BC when hit`;
                msg += get_duration_and_target(effects["bc fill when attacked turns (38)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '22': {
            desc: "Defense Ignore",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = `${effects['defense% ignore']}% DEF ignore`;
                msg += get_duration_and_target(effects["defense% ignore turns (39)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '23': {
            desc: "Spark Damage",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = get_polarized_number(effects["spark dmg% buff (40)"]) + "% spark DMG";

                msg += get_duration_and_target(effects);
                return msg;
            }
        },
        '24': {
            desc: "Stat Conversion",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var buff = adr_buff_handler(effects['atk% buff (46)'], effects['def% buff (47)'], effects['rec% buff (48)']);
                var source_buff = effects['converted attribute'].toUpperCase().slice(0, 3);
                if(source_buff === "ATT") source_buff = "ATK";
                var msg = "Convert " + buff.replace('% ', "% " + source_buff + " to ");
                msg += get_duration_and_target(effects["% converted turns"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '29': {
            desc: "Multi-Elemental Attack",
            notes: ["These elements are added onto the attack of the unit's base element"],
            type: ["attack"],
            func: function (effects, damage_frames, base_element) {
                var numHits = damage_frames.hits;
                var msg = numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                msg += effects["bb atk%"] + "% ";
                msg += to_proper_case(effects["bb elements"][0]);
                for(let e = 1; e < effects["bb elements"].length; ++e){
                    msg += "/" + to_proper_case(effects["bb elements"][e]);
                }
                msg += " " + ((effects["target area"].toUpperCase() === "SINGLE") ? "ST" : effects["target area"].toUpperCase());
                if (effects["bb flat atk"]) msg += " (+" + effects["bb flat atk"] + " flat ATK)";
                return msg;
            }
        },
        '30': {
            desc: "Elemental Buffs",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = elemental_buff_handler(effects);
                msg += get_duration_and_target(effects["elements added turns"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '38': {
            desc: "Status Cleanse (Ailments and/or Stat Reductions)",
            notes: ["Status ailments refers to the basic 6 paralysis,injury,etc.", "Stat reductions refer to ATK/DEF/REC down", "Ailments refers to both status ailments and stat reductions"],
            type: ["effect"],
            func: function (effects, damage_frames, base_element) {
                var msg = "Clears " + ailments_cured_handler(effects["ailments cured"]);
                msg += get_duration_and_target(undefined,effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '31': {
            desc: "BC Insta-fill/Flat BB Gauge Increase",
            type: ["effect"],
            func: function (effects, damage_frames, base_element) {
                var msg = `${get_polarized_number(effects["increase bb gauge"])} BC fill`;
                msg += get_duration_and_target(undefined, effects['target area'], effects['target type']);
                return msg;
            }
        },
        '40': {
            desc: "Status Ailment Inflict When Attacking",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = ailment_buff_handler(effects);
                msg += get_duration_and_target(effects);
                return msg;
            }
        },
        '43': {
            desc: "Burst OD Fill",
            type: ["effect"],
            func: function (effects, damage_frames, base_element) {
                var msg = `${get_polarized_number(effects["increase od gauge%"])}% OD gauge fill`;
                return msg;
            }
        },
        '44': {
            desc: "Damage Over Time (DoT)",
            notes: ["unit 720176 has some weird values with this ID"],
            type: ["debuff"],
            func: function (effects, damage_frames, base_element) {
                var msg = effects["dot atk%"] + "% DoT";
                if (effects['dot flat atk'])
                    msg += ", +" + effects["dot flat atk"] + " flat ATK";
                if (effects['dot dmg%'])
                    msg += ", +" + effects['dot dmg%'] + "% multiplier";
                if (effects['dot element affected'] === false) {
                    msg += " (EWD doesn't apply)";
                }

                msg += get_duration_and_target(effects["dot turns (71)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '45': {
            desc: "BB/SBB/UBB ATK",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = bb_atk_buff_handler(effects["bb atk% buff"], effects["sbb atk% buff"], effects["ubb atk% buff"]);

                if (msg.length === 0) {
                    throw "Message length is 0";
                }
                msg += get_duration_and_target(effects["buff turns (72)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '47': {
            desc: "HP Scaling Attack",
            type: ["attack"],
            func: function (effects, damage_frames, base_element) {
                var numHits = damage_frames.hits;
                var max_total = parseInt(effects["bb base atk%"]) + parseInt(effects["bb added atk% based on hp"]);
                var msg = numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                msg += `${get_formatted_minmax(effects["bb base atk%"],max_total)}% `;
                msg += (effects["target area"].toUpperCase() === "SINGLE") ? "ST" : effects["target area"].toUpperCase();
                if (effects["bb flat atk"]) msg += ` (based on HP ${effects["bb added atk% proportional to hp"]}, +` + effects["bb flat atk"] + " flat ATK)";
                else msg += ` (based on HP ${effects["bb added atk% proportional to hp"]})`;
                if (effects["bb bc%"]) msg += ", innate +" + effects["bb bc%"] + "% BC drop rate";
                if (effects["bb crit%"]) msg += ", innate +" + effects["bb crit%"] + "% crit rate";
                // if (effects["bb hc%"]) msg += ", innate +" + effects["bb hc%"] + "% HC drop rate";
                return msg;
            }
        },
        '53': {
            desc: "Ailment Reflect",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = ailment_reflect_handler(effects);
                msg += get_duration_and_target(effects["counter inflict ailment turns"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '54': {
            desc: "Critical Hit Damage",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = get_polarized_number(effects["crit multiplier%"]) + "% crit DMG";

                msg += get_duration_and_target(effects["buff turns (84)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '55': {
            desc: "Elemental Weakness Damage (EWD)",
            notes: ["FWETLD corresponds to fire, water, earth, thunder, light, and dark, respectively"],
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = ewd_buff_handler(effects);
                if (msg.length === 0) {
                    throw "Message length is 0";
                }
                msg += get_duration_and_target(effects["elemental weakness buff turns"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '56': {
            desc: "Chance Angel Idol (AI)",
            notes: ["This buff cannot be buff wiped"],
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = effects["angel idol recover chance%"] + "% chance AI";
                if (effects["angel idol recover hp%"]) msg += " (recovers " + effects["angel idol recover hp%"] + "% HP on proc)";

                msg += get_duration_and_target(effects["angel idol buff turns (91)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '58': {
            desc: "Spark Vulnerability to Enemy",
            type: ["debuff"],
            func: function (effects, damage_frames, base_element) {
                var msg = `${effects["spark dmg received apply%"]}% chance to inflict ${parseInt(effects["spark dmg received debuff turns (94)"])+1} turn ${get_polarized_number(effects["spark dmg% received"])}% Spark vulnerability debuff`;
                msg += get_duration_and_target(undefined, effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '62': {
            desc: "Elemental Barrier",
            type: ["buff"],
            notes: ["This buff cannot be buff wiped", "Unless otherwise specified, assume that the barrier has 100% DMG absorption"],
            func: function (effects, damage_frames, base_element) {
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
            func: function (effects, damage_frames, base_element) {
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
            func: function (effects, damage_frames, base_element) {
                var msg = `${get_polarized_number(effects["atk% buff when enemy has ailment"])}% ATK to status afflicted foes`;
                msg += get_duration_and_target(effects["atk% buff turns (110)"],effects);
                return msg;
            }
        },
        '66': {
            desc: "Revive Allies",
            type: ["effect"],
            func: function (effects, damage_frames, base_element) {
                var msg = `${effects["revive unit chance%"]}% chance to revive allies with ${effects["revive unit hp%"]}% HP`;
                msg += ` (${effects["target area"]},${effects["target type"]})`
                return msg;
            }
        },
        '67': {
            desc: "BC Fill on Spark",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = `${effects["bc fill on spark%"]}% chance to fill ${get_formatted_minmax(effects["bc fill on spark low"], effects["bc fill on spark high"])} BC on spark`;
                msg += get_duration_and_target(effects["bc fill on spark buff turns (111)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '78': {
            desc: "Self ATK/DEF/REC/Crit Rate",
            notes: ["Stacks with the regular party ATK/DEF/REC/Crit Rate buff", "Example of a unit having both party and self is Silvie (840128)"],
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = "";
                if (effects["self atk% buff"] || effects["self def% buff"] || effects["self rec% buff"]) { //regular tri-stat
                    msg += adr_buff_handler(effects["self atk% buff"], effects["self def% buff"], effects["self rec% buff"]);
                }
                if (effects["self crit% buff"]) {//crit rate buff
                    if (msg.length > 0) msg += ", ";
                    msg += "+" + effects["self crit% buff"] + "% crit rate";
                }

                if (msg.length === 0) {
                    throw "Message length is 0";
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
            func: function (effects, damage_frames, base_element) {
                var msg = `${effects["spark dmg inc chance%"]}% chance for a ${get_polarized_number(effects["spark dmg inc% buff"])}% spark critical`;
                msg += get_duration_and_target(effects["spark dmg inc buff turns (131)"], effects);
                return msg;
            }
        },
        '84': {
            desc: "OD Fill Rate",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
                var msg = `${get_polarized_number(effects["od fill rate% buff"])}% OD gauge fill rate`;
                msg += get_duration_and_target(effects["od fill rate buff turns (132)"], effects);
                return msg;
            }
        },
        '85': {
            desc: "Heal on Hit",
            type: ["buff"],
            func: function (effects, damage_frames, base_element) {
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
            func: function (effects, damage_frames, base_element) {
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

    var unknown_proc_buffs = {
        '0': {
            desc: "None",
            type: ["none"],
            notes: ["First found on itme 800104"],
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
        }
    };

    var passive_buffs = {

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
        if(!handler || !id){
            if(!id) console.log("Couldn't find ID in", type);
            return `Unknown buff type "${type}"`;
        }

        try{
            let msg = `Received ${type} id ${id} `;
            if(handler[id]){
                msg += `${handler[id].desc}`;
                if(handler[id].notes) msg += "\n  " + handler[id].notes.join(" / ");
                console.log(msg);

                return handler[id].func(effects, other_data);
            }else{
                console.log(msg);
                return `${to_proper_case(type)} ID ${id} is not supported yet`;
            }
        }catch(err){
            console.log(`Error at ${to_proper_case(type)} ${id} =>`,err);
            return `${to_proper_case(type)} ID ${id} has an error`;
        }
    }

    //given an effects object, print get its effects
    function print_buff(effect, other_data) {
        var msg = "";
        // console.log("Received " + effects);
        if (effect["proc id"]) {
            msg = general_handler(effect,other_data,"proc");
        } else if (effect["passive id"]) {
            msg = general_handler(effect, other_data, "passive");
        } else if (effect["unknown proc id"]) {
            msg = general_handler(effect, other_data, "unknown proc");
        } else if (effect["unknown passive id"]) {
            msg = general_handler(effect, other_data, "unknown passive");
        } else if (effect["unknown buff id"]) {
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

var buff_processor = new BuffProcessor();

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
            translated_buffs.push(buff_processor.print_buff(effects[e], other_data));
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

    function printES(){
        if (!unit) throw "No unit specified";
        let es_object = unit["extra skill"];
        if(!es_object) return `No Extra Skill data found`;
        return process_effects(es_object.effects);
    }
    this.printES = printES;

    function printSP(){
        if (!unit) throw "No unit specified";
        return "Printing SP effects is not supported yet"
    }
    this.printSP = printSP;
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
    let db_types = ['bbs', 'es', 'feskills', 'info', 'items', 'ls'];
    let servers = ['gl', 'eu', 'jp'];

    for (let s = 0; s < servers.length; ++s) {
        for (let d = 0; d < db_types.length; ++d) {
            console.log(`Scraping ${db_types[d]}-${servers[s]}.json`);
            let db = JSON.parse(fs.readFileSync(`./sandbox_data/${db_types[d]}-${servers[s]}.json`, 'utf8'));
            buff_scraper.getBuffDataForAllinDB(db, db_types[d]);
        }
    }

    var result = buff_scraper.getResult();
    for (let f in result) {
        let filename = `./full_${f}_id.json`;
        console.log("Saving", filename)
        fs.writeFileSync(filename, JSON.stringify(result[f], null, 4));
    }

    console.log("done");
}



var itemQuery = {
    item_name_id: "20102",
    // effect: "resist curse%"
    // rarity: 0,
    // strict: "true"
    verbose: true
};

function doItemTest(){
    return client.searchItem(itemQuery)
        .then(function(results){
            if(results.length === 1){
                // console.log(results);
                // return client.getItem(result[0]);
                return client.getItem(results[0]).then(function(item){
                    let msg = printItem(item);
                    console.log(JSON.stringify(item, null, 2));
                    console.log(item.name,"-",item.desc);
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



var unitQuery = {
    // unit_name_id: "neferet",
    unit_name_id: "60116",
    strict: "false",
    // server: "JP",
    // rarity: 7,
    // element: 'light'
    // verbose: 'true'
};

function doUnitTest(){
    return client.searchUnit(unitQuery)
        .then(function (result) {
            if(result.length === 1){
                return client.getUnit(result[0]).then(function(unit){
                    let unit_printer = new UnitEffectPrinter(unit);
                    let msg = unit_printer.printBurst("ubb");

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
            // console.log(result.split('\n\n'));
            // console.log(result.length,result);
            console.log(result);
            // console.log(JSON.stringify(buff_processor.proc_buffs,null,2));
        })
        .catch(console.log);
}

function doBurstTest(){
    var bursts = JSON.parse(fs.readFileSync('./sandbox_data/bbs-eu.json','utf8'));
    let printBurst = new UnitEffectPrinter({}).printBurst;


    let id = "3116";
    let burst_object = bursts[id];
    console.log(JSON.stringify(burst_object,null,2));
    if(burst_object){
        let msg = printBurst(burst_object);
        console.log(burst_object.name);
        console.log(msg);
    } else 
        console.log("No burst found with ID",id);
}

// getBuffDataForAll();
doItemTest();
// doUnitTest();
// doBurstTest();
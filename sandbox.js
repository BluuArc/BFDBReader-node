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

    var buff_types = {
        attack: `unit attacks enemy`,
        buff: `unit gains some sort of enhancement to their stats or attacks, can last more than one turn`,
        debuff: `unit's attack inflicts some ailment onto the enemy`,
        effect: `buff does something directly to the unit(s) on that turn; multiple instances of itself on the same turn will stack`
    }; 
    var proc_buffs = {
        '1': {
            desc: "Regular Attack",
            type: ["attack"],
            func: function(effects,damage_frames,base_element){
                var numHits = damage_frames.hits;
                var msg = numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                msg += effects["bb atk%"] + "% ";
                msg += (effects["target area"].toUpperCase() === "SINGLE") ? "ST" : effects["target area"].toUpperCase();
                if (effects["bb flat atk"]) msg += " (+" + effects["bb flat atk"] + " flat ATK)";
                if (effects["bb bc%"]) msg += ", innate +" + effects["bb bc%"] + "% BC drop rate";
                if (effects["bb crit%"]) msg += ", innate +" + effects["bb crit%"] + "% crit rate";
                if (effects["bb hc%"]) msg += ", innate +" + effects["bb hc%"] + "% HC drop rate";
                return msg;
            }
        },
        '2': {
            desc: "Burst Heal",
            type: ["effect"],
            notes: ["if no hits are mentioned, then the burst heal happens all at once", "over multiple hits means that for every hit, units heal a fraction of the burst heal"],
            func: function (effects, damage_frames, base_element){
                var msg = get_formatted_minmax(effects['heal low'], effects['heal high']) + " HP burst heal ";
                msg += "(+" + effects['rec added% (from healer)'] + "% healer REC)";
                if (damage_frames.hits > 1)
                    msg += " over " + damage_frames.hits + " hits";
                msg += " (" + effects["target area"] + "," + effects["target type"] + ")";
                return msg;
            }
        },
        '3': {
            desc: "Heal over Time (HoT)",
            type: ["buff"],
            func: function (effects, damage_frames, base_element){
                var msg = get_formatted_minmax(effects["gradual heal low"], effects["gradual heal high"]) + " HP HoT";
                msg += " (+" + effects["rec added% (from target)"] + "% target REC)";

                msg += get_duration_and_target(effects["gradual heal turns (8)"], effects["target area"], effects["target type"]);
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

    function proc_handler(effects, damage_frames, base_element) {
        var id = effects["proc id"].toString();
        var msg = `Received ${id}`;
        // console.log(JSON.stringify(proc_buffs,null,2));
        try{
            if(proc_buffs[id] !== undefined){
                if (proc_buffs[id].notes) console.log(msg, proc_buffs[id].desc,"\n ",proc_buffs[id].notes.join(" / "));
                else    console.log(msg,proc_buffs[id].desc);
                return proc_buffs[id].func(effects,damage_frames,base_element);
            }else{
                console.log(msg);
                return `Proc ID ${id} is not supported yet`;
            }
        }catch(err){
            console.log(`Error at Proc ${id}:`,err);
            return `Proc ID ${id} has an error`;
        }
    }

    //given an effects object, print get its effects
    function print_buff(effects, damage_frames, element) {
        var msg = "";
        var id;
        // console.log("Received " + effects);
        if (effects["proc id"] !== undefined) {
            msg = proc_handler(effects, damage_frames, element);
        } else if (effects["passive id"] !== undefined) {
            id = effects["passive id"];
            msg += "Passive ID " + id + " is not supported yet.";
        } else if (effects["unknown proc id"] !== undefined) {
            id = effects["unknown proc id"];
            msg += "Proc ID " + id + " is not supported yet.";
        } else if (effects["unknown passive id"] !== undefined) {
            id = effects["unknown proc id"];
            msg += "Passive ID " + id + " is not supported yet.";
        } else if (effects["unknown buff id"] !== undefined) {
            id = effects["unkown buff id"];
            msg += "Buff ID " + id + " is not supported yet.";
        } else {
            console.log("Unkown effects object. Using legacy printer.");
            // console.log(effects);
            msg = print_effect_legacy(effects);
        }
        return msg;
    }

    this.print_buff = print_buff;
    this.proc_buffs = proc_buffs;
};

var buff_processor = new BuffProcessor();


function print_effects_legacy(effects) {
    var print_array = function(arr) {
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

function printBurst(unit, burst_type){
    var burst_object = unit[burst_type];
    var msg = "";
    var numLevels = burst_object.levels.length;
    var burst_effects = burst_object.levels[numLevels-1];
    // console.log(burst_effects);
    for(var i = 0; i < burst_effects.effects.length; ++i){
        // msg += printBuffs(burst_effects.effects[i], burst_object["damage frames"][i], unit.element);
        msg += buff_processor.print_buff(burst_effects.effects[i], burst_object["damage frames"][i], unit.element);
        if(i !== burst_effects.effects.length-1){
            msg += " / ";
        }
    }
    return msg;
}

var itemQuery = {
    item_name_id: "honor claw",
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
                    // console.log(JSON.stringify(item,null,'  '));
                    return get_full_usage(results[0]).then(function(result){
                        // return JSON.stringify(result,null,'  ');
                        var msg = `${item.name} (${item.id}) can be used to immediately make:\n`;
                        for(let i = 0; i < result.immediate.length; ++i){
                            msg += result.immediate[i] + "\n";
                        }

                        msg += "\nIt is also a material for the following other items:\n";
                        for(let i = 0; i < result.end.length; ++i){
                            msg += result.end[i] + "\n";
                        }

                        return msg;
                    });
                    // return get_full_recipe(results[0]).then(function(result){
                    //     // var msg = "To make " + item.name + " you need:\n";
                    //     var msg = `To make ${item.name} (${item.id}) you need the following base materials:\n`;
                        // for(var i = 0; i < result.length; ++i){
                        //     // var count = result.counts[i];
                        //     // var mat = result.result_str[i];
                        //     // msg += count + "x " + mat + "\n";
                        //     msg += `${result[i].count}x ${result[i].name}\n`;
                        // }
                    //     return msg;
                    // });
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
    unit_name_id: "ceulfan",
    strict: "false",
    // server: "JP",
    // rarity: 8,
    // element: 'light'
    // verbose: 'true'
};

function doUnitTest(){
    return client.searchUnit(unitQuery)
        .then(function (result) {
            if(result.length === 1){
                return client.getUnit(result[0]).then(function(unit){
                    var burst_type = "bb";
                    console.log(unit[burst_type]["damage frames"]);
                    console.log(unit[burst_type].levels[0].effects);
                    if(unit.translated_name) console.log(unit.translated_name);
                    console.log(unit.name, unit.id);
                    console.log(unit[burst_type].desc);
                    return printBurst(unit, burst_type);
                    // console.log(unit);
                    // return print_evo(unit);
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

var BuffScraper = function(){
    var result_obj = undefined;
    //object_id: ID of unit/item
    //cur_object: object currently being analyzed
    //acc_object: object to store all the data (pass in result_obj)
    //object_type: unit or item
    function getBuffData (object_id, cur_object, acc_object, object_type) {
        function addObjectToAccumulator(object_id, cur_object, index_object, object_type) {
            let gray_listed = ["hit dmg% distribution", "hit dmg% distribution (total)", "frame times"];
            let black_listed = ['proc id', 'passive id']; //prevent duplicate info
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
                if (index_object[f][object_type] === undefined) {
                    index_object[f][object_type] = {
                        values: [],
                        id: []
                    };
                }
                //if it's not a graylisted type
                if (gray_listed.indexOf(f) === -1) {
                    let field_value = (function (value) {
                        if (typeof value === "object" || value instanceof Array) {
                            return JSON.stringify(value);
                        } else {
                            return value;
                        }
                    })(cur_object[f])
                    //if there's a unique value, add it to the index_object
                    if (index_object[f][object_type].values.indexOf(field_value) === -1 && index_object[f][object_type].id.indexOf(object_id) === -1) {
                        index_object[f][object_type].values.push(field_value);
                        index_object[f][object_type].id.push(object_id);
                    }
                } else { //add to the IDs list if length is less than 5 and object_id is not in list yet
                    if (index_object[f][object_type].id.length < 5 && index_object[f][object_type].id.indexOf(object_id) === -1) {
                        index_object[f][object_type].id.push(object_id);
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
                let unique_index = "", property_type = ""
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
        if(result_obj === undefined){
            result_obj = {
                passive: { },
                proc: { },
                buff: { }
            };
        }

        //get buff data of all units
        for(let id in database){
            getBuffData(id,database[id],result_obj,database_name);
        }

        
        // fs.writeFileSync("./test_buff_id.json", JSON.stringify(result_obj, null, "\t"));
        // return result_obj;
    }
    this.getBuffDataForAllinDB = getBuffDataForAllinDB;

    this.getResult = function(){
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


//scan all files and get buff data
function getBuffDataForAll(){
    let buff_scraper = new BuffScraper();
    let db_types = ['bbs','es','feskills','info','items','ls'];
    let servers = ['gl','eu','jp'];

    for(let s = 0; s < servers.length; ++s){
        for(let d = 0; d < db_types.length; ++d){
            console.log(`Scraping ${db_types[d]}-${servers[s]}.json`);
            let db = JSON.parse(fs.readFileSync(`./sandbox_data/${db_types[d]}-${servers[s]}.json`, 'utf8'));
            buff_scraper.getBuffDataForAllinDB(db,db_types[d]);
        }
    }

    var result = buff_scraper.getResult();
    for(let f in result){
        let filename = `./full_${f}_id.json`;
        console.log("Saving",filename)
        fs.writeFileSync(filename, JSON.stringify(result[f], null, 4));
    }
    
    console.log("done");
}


getBuffDataForAll();
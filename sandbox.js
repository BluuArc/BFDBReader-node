var client = require('./data_tier_client.js');

client.setAddress("http://127.0.0.1:8081");

var buff_processor = (function(){
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

    function get_duration_and_target(turns, area, type) {
        var msg = "";
        //first param is an effects object
        if ((typeof turns).toLowerCase() === 'object') {
            area = turns["target area"]
            type = turns["target type"]
            turns = turns["buff turns"]
        }
        msg += " for " + turns + (turns === 1 ? " turn" : " turns");
        msg += " (" + area + "," + type + ")";
        return msg;
    }

    var proc_buffs = {
        '1': {
            desc: "Regular Attack",
            func: function(effects,damage_frames,base_element){
                var numHits = damage_frames.hits;
                var msg = numHits.toString() + ((numHits === 1) ? " hit " : " hits ");
                msg += effects["bb atk%"] + "% ";
                msg += (effects["target area"].toUpperCase() === "SINGLE") ? "ST" : effects["target area"].toUpperCase();
                if (effects["bb flat atk"]) msg += " (+" + effects["bb flat atk"] + ")";
                if (effects["bb bc%"]) msg += ", innate +" + effects["bb bc%"] + "% BC drop rate";
                if (effects["bb crit%"]) msg += ", innate +" + effects["bb crit%"] + "% crit rate";
                if (effects["bb hc%"]) msg += ", innate +" + effects["bb hc%"] + "% HC drop rate";
                return msg;
            }
        },
        '2': {
            desc: "Burst Heal",
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
            func: function (effects, damage_frames, base_element){
                var msg = get_formatted_minmax(effects["gradual heal low"], effects["gradual heal high"]) + " HP HoT";
                msg += " (+" + effects["rec added% (from target)"] + "% target REC)";

                msg += get_duration_and_target(effects["gradual heal turns (8)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '5': {
            desc: "Regular and Elemental ATK/DEF/REC/Crit Rate",
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
        '9': {
            desc: "ATK/DEF down to enemy",
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
            func: function (effects, damage_frames, base_element) {
                var msg = ailment_inflict_handler(effects);
                if (msg.length === 0) throw "Message length is 0";
                return msg;
            }
        },
        '19': {
            desc: "BC Fill per Turn",
            func: function (effects, damage_frames, base_element) {
                var msg = effects["increase bb gauge gradual"] + " BC/turn";

                msg += get_duration_and_target(effects["increase bb gauge gradual turns (37)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '23': {
            desc: "Spark Damage",
            func: function (effects, damage_frames, base_element) {
                var msg = get_polarized_number(effects["spark dmg% buff (40)"]) + "% spark DMG";

                msg += get_duration_and_target(effects);
                return msg;
            }
        },
        '24': {
            desc: "Stat Conversion",
            func: function (effects, damage_frames, base_element) {
                var buff = adr_buff_handler(effects['atk% buff (46)'], effects['def% buff (47)'], effects['rec% buff (48)']);
                var source_buff = effects['converted attribute'].toUpperCase().slice(0, 3);
                if(source_buff === "ATT") source_buff = "ATK";
                var msg = "Convert " + buff.replace('% ', "% " + source_buff + " to ");
                msg += get_duration_and_target(effects["% converted turns"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '44': {
            desc: "Damage Over Time (DoT)",
            notes: ["unit 720176 has some weird values with this ID"],
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
            func: function (effects, damage_frames, base_element) {
                var msg = bb_atk_buff_handler(effects["bb atk% buff"], effects["sbb atk% buff"], effects["ubb atk% buff"]);

                if (msg.length === 0) {
                    throw "Message length is 0";
                }
                msg += get_duration_and_target(effects["buff turns (72)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '54': {
            desc: "Critical Hit Damage",
            func: function (effects, damage_frames, base_element) {
                var msg = get_polarized_number(effects["crit multiplier%"]) + "% crit DMG";

                msg += get_duration_and_target(effects["buff turns (84)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '55': {
            desc: "Elemental Weakness Damage (EWD)",
            notes: ["FWETLD corresponds to fire, water, earth, thunder, light, and dark, respectively"],
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
            func: function (effects, damage_frames, base_element) {
                var msg = effects["angel idol recover chance%"] + "% chance AI";
                if (effects["angel idol recover hp%"]) msg += " (recovers " + effects["angel idol recover hp%"] + "% HP on proc)";

                msg += get_duration_and_target(effects["angel idol buff turns (91)"], effects["target area"], effects["target type"]);
                return msg;
            }
        },
        '66': {
            desc: "Revive Allies",
            func: function (effects, damage_frames, base_element) {
                var msg = `${effects["revive unit chance%"]}% chance to revive allies with ${effects["revive unit hp%"]}% HP`;
                msg += ` (${effects["target area"]},${effects["target type"]})`
                return msg;
            }
        },
        '85': {
            desc: "Heal on Hit",
            func: function (effects, damage_frames, base_element) {
                var msg = effects["hp recover from dmg chance"] + "% chance to heal ";
                msg += get_formatted_minmax(effects["hp recover from dmg% low"], effects["hp recover from dmg% high"]) + "% DMG when hit";

                msg += get_duration_and_target(effects["hp recover from dmg buff turns (133)"], effects["target area"], effects["target type"]);
                return msg;
            }
        }


    };//end proc_buffs

    function proc_handler(effects, damage_frames, base_element) {
        var id = effects["proc id"].toString();
        var msg = `Received ${id}`;
        // console.log(JSON.stringify(proc_buffs,null,2));
        try{
            if(proc_buffs[id] !== undefined){
                console.log(msg,proc_buffs[id].desc);
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

    return {
        print_buff: print_buff,
    };
})();

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

//given an effects object, print get its effects
function printBuffs(effects, damage_frames, element){
    var msg = "";
    var id;
    // console.log("Received " + effects);
    if(effects["proc id"] !== undefined){
        msg = proc_handler(effects,damage_frames, element);
    }else if(effects["passive id"] !== undefined){
        id = effects["passive id"];
        msg += "Passive ID " + id + " is not supported yet.";
    }else if(effects["unknown proc id"] !== undefined){
        id = effects["unknown proc id"];
        msg += "Proc ID " + id + " is not supported yet.";
    }else if(effects["unknown passive id"] !== undefined){
        id = effects["unknown proc id"];
        msg += "Passive ID " + id + " is not supported yet.";
    }else if(effects["unknown buff id"] !== undefined){
        id = effects["unkown buff id"];
        msg += "Buff ID " + id + " is not supported yet.";
    }else{
        console.log("Unkown effects object. Using legacy printer.");
        // console.log(effects);
        msg = print_effects_legacy(effects);
    }
    return msg;
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

// client.searchItem(itemQuery)
    // .then(function(results){
    //     if(results.length === 1){
    //         // console.log(results);
    //         // return client.getItem(result[0]);
    //         return client.getItem(results[0]).then(function(item){
    //             // console.log(JSON.stringify(item,null,'  '));
    //             return get_full_usage(results[0]).then(function(result){
    //                 // return JSON.stringify(result,null,'  ');
    //                 var msg = `${item.name} (${item.id}) can be used to immediately make:\n`;
    //                 for(let i = 0; i < result.immediate.length; ++i){
    //                     msg += result.immediate[i] + "\n";
    //                 }

    //                 msg += "\nIt is also a material for the following other items:\n";
    //                 for(let i = 0; i < result.end.length; ++i){
    //                     msg += result.end[i] + "\n";
    //                 }

    //                 return msg;
    //             });
    //             // return get_full_recipe(results[0]).then(function(result){
    //             //     // var msg = "To make " + item.name + " you need:\n";
    //             //     var msg = `To make ${item.name} (${item.id}) you need the following base materials:\n`;
    //                 // for(var i = 0; i < result.length; ++i){
    //                 //     // var count = result.counts[i];
    //                 //     // var mat = result.result_str[i];
    //                 //     // msg += count + "x " + mat + "\n";
    //                 //     msg += `${result[i].count}x ${result[i].name}\n`;
    //                 // }
    //             //     return msg;
    //             // });
    //         });
    //     }else{
    //         return results;
    //     }
    // })
    // .then(function (result) {
    //     console.log(result);
    //     // console.log(result.recipe.materials);
    // })
    // .catch(console.log);



var unitQuery = {
    // unit_name_id: "neferet",
    unit_name_id: "feng",
    strict: "false",
    // server: "GL",
    // rarity: 8
};

client.searchUnit(unitQuery)
    .then(function (result) {
        if(result.length === 1){
            return client.getUnit(result[0]).then(function(unit){
                var burst_type = "ubb";
                console.log(unit.name);
                console.log(unit[burst_type].desc);
                console.log(unit[burst_type]["damage frames"]);
                console.log(unit[burst_type].levels[0].effects);
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
    })
    .catch(console.log);
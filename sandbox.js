var client = require('./data_tier_client.js');

client.setAddress("http://127.0.0.1:8081");

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

function flatten_string_array(arr, divider){
    var msg = "";
    if(arr === undefined || arr.length === 0){
        return msg;
    }
    if(divider === undefined){
        divider = ",";
    }
    msg += arr[0];
    for(var i = 1; i < arr.length; ++i){
        msg += divider + arr[i];
    }
    return msg;
}

function get_polarized_number(number){
    if(number < 0)  return number.toString();
    else            return "+" + number.toString();
}

function get_formatted_minmax(min,max){
    return min + "-" + max;
}

function adr_buff_handler(atk,def,rec){
    var msg = "";
    if(atk && def && rec){
        if(atk === def){
            if(atk === rec){ //equal tri-stat
                msg = get_polarized_number(atk) + "% ATK/DEF/REC";
            }else{//eq atk and def, but not rec
                msg = get_polarized_number(atk) + "% ATK/DEF, " + get_polarized_number(rec) + "% REC";
            }
        }else if(atk === rec){ //eq atk and rec, but not def
            msg = get_polarized_number(atk) + "% ATK/REC, " + get_polarized_number(def) + "% DEF";
        }else if(def === rec){ //eq def and rec, but not rec
            msg = get_polarized_number(def) + "% DEF/REC, " + get_polarized_number(atk) + "% ATK";
        }else{ //all unequal
            msg = get_polarized_number(atk) + "% ATK, " + get_polarized_number(def) + "% DEF, " + get_polarized_number(rec) + "% REC";
        }
    }else if(atk && def){
        if(atk === def){
            msg = get_polarized_number(atk) + "% ATK/DEF";
        }else{
            msg = get_polarized_number(atk) + "% ATK, " + get_polarized_number(def) + "% DEF";
        }
    }else if(atk && rec){
        if(atk === rec){
            msg = get_polarized_number(atk) + "% ATK/REC";
        }else{
            msg = get_polarized_number(atk) + "% ATK, " + get_polarized_number(rec) + "% REC";
        }
    }else if(def && rec){
        if(def === rec){
            msg = get_polarized_number(def) + "% DEF/REC";
        }else{
            msg = get_polarized_number(def) + "% DEF, " + get_polarized_number(rec) + "% REC";
        }
    }else if(atk){
        msg = get_polarized_number(atk) + "% ATK";
    }else if(def){
        msg = get_polarized_number(def) + "% DEF";
    }else if(rec){
        msg = get_polarized_number(rec) + "% REC";
    }
    if(msg.length === 0){
        console.log("Missed a combo of atk,def,rec (" + atk +"," + def + "," + rec);
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
    }else{
        msg += " ATK";
    }
    return msg;
}

function ewd_buff_handler(effects){
    var elements = ['Fire', 'Water', 'Earth', 'Thunder', 'Light', 'Dark'];
    var suffix = " units do extra elemental weakness dmg";
    var found = [];
    var i;
    var msg = get_polarized_number(effects["elemental weakness multiplier%"]) + "% ";
    for(i = 0; i < elements.length; ++i){
        var curBuff = effects[elements[i].toLowerCase() + suffix];
        if(curBuff){ //add first letter to message
            found.push(elements[i]);
        }
    }

    if(found.length === 0){
        throw "No EWD buffs found";
    }else if(found.length <= 2){ //only 1 or 2 EWD buffs, so full names are fine
        msg += elements[0];
        for(i = 1; i < found.length; ++i){
            msg += "/" + elements[i];
        }
    }else if(found.length === elements.length){ //buff for all elements
        msg += "all elements";
    }else{
        for(i = 0; i < found.length; ++i){ //multiple EWD buffs, so use first letter only
            msg += elements[i][0];
        }
    }
    msg += " EWD";

    //format: #% FWETLD EWD
    return msg;
}

function ailment_inflict_handler(effects){
    var ailments = ["injury%", "poison%", "sick%", "weaken%", "curse%", "paralysis%"];
    var values = {};
    var msg = "";
    //sort values by proc chance
    for(var i = 0; i < ailments.length; ++i){
        var curAilment = effects[ailments[i]];
        if(curAilment){
            console.log(ailments[i],curAilment);
            if(!values[curAilment.toString()]){
                values[curAilment.toString()] = [];
            }
            values[curAilment.toString()].push(ailments[i].replace('%', ""));
        }
    }

    console.log(values);

    for(var a in values){
        if(msg.length > 0) msg += ", ";

        msg += a + "% chance to inflict ";
        for(var ailment = 0; ailment < values[a].length; ++ailment){
            msg += values[a][ailment];
            if (ailment !== values[a].length-1){
                msg += "/";
            }
        }
    }
    return msg;
}

function get_duration_and_target(turns, area, type){
    var msg = "";
    //first param is an effects object
    if((typeof turns).toLowerCase() === 'object'){
        area = turns["target area"]
        type = turns["target type"]
        turns = turns["buff turns"]
    }
    msg += " for " + turns + (turns === 1 ? " turn" : " turns");
    msg += " (" + area + "," + type + ")";
    return msg;
}

function proc_handler(effects, damage_frames, base_element){
    var id = effects["proc id"].toString();
    var msg = "";
    if(id !== undefined){
        console.log("Received " + id);
        try{
            switch(id){
                case '1': //regular attack
                    var numHits = damage_frames.hits;
                    msg = numHits.toString() + ((numHits === 1) ? " hit " : " hits "); 
                    msg += effects["bb atk%"] + "% ";
                    msg += (effects["target area"].toUpperCase() === "SINGLE") ? "ST" : effects["target area"].toUpperCase();
                    if(effects["bb flat atk"]) msg += " (+" + effects["bb flat atk"] + ")";
                    if(effects["bb bc%"]) msg += ", innate +" + effects["bb bc%"] + "% BC drop rate";
                    if(effects["bb crit%"]) msg += ", innate +" + effects["bb crit%"] + "% crit rate";
                    if (effects["bb hc%"]) msg += ", innate +" + effects["bb hc%"] + "% HC drop rate";
                    return msg;
                case '5': //stat buffs
                    if (effects["atk% buff (1)"] || effects["def% buff (3)"] || effects["rec% buff (5)"]){ //regular tri-stat
                        msg += adr_buff_handler(effects["atk% buff (1)"],effects["def% buff (3)"],effects["rec% buff (5)"]);
                    }
                    if(effects["crit% buff (7)"]){//crit rate buff
                        if(msg.length > 0) msg += ", ";
                        msg += "+" + effects["crit% buff (7)"] + "% crit rate";
                    }

                    if (effects["def% buff (4)"]) {//decreased def buff (EU)
                        if (msg.length > 0) msg += ", ";
                        msg += (effects["def% buff (4)"] < 0 ? effects["def% buff (4)"] : ("+" + effects["def% buff (4)"])) + "% DEF";
                    }

                    if (effects["atk% buff (13)"] || effects["def% buff (14)"] || effects["rec% buff (15)"]){ //elemental tri-stat
                        msg += adr_buff_handler(effects["atk% buff (13)"],effects["def% buff (14)"],effects["rec% buff (15)"]);
                    }
                    if (effects["crit% buff (16)"]) { //elemental crit buff
                        if (msg.length > 0) msg += ", ";
                        msg += "+" + effects["crit% buff (16)"] + "% crit rate";
                    }
                    if(effects['element buffed'] !== "all"){
                        msg += " to " + effects['element buffed'];
                    }
                    if (msg.length === 0) {
                        throw "Message length is 0";
                    }
                    msg += get_duration_and_target(effects);
                    return msg;
                    
                case '9': //stat down to enemy (not party buff)
                    if (effects['buff #1']){
                        var atk_debuff = effects['buff #1'];
                        msg += atk_debuff['proc chance%'] + "% chance for " + get_polarized_number(atk_debuff['atk% buff (2)']) + "% ATK";
                    }
                    if(effects['buff #2']){
                        if (msg.length > 0) msg += ", ";
                        var def_debuff = effects['buff #2'];
                        msg += def_debuff['proc chance%'] + "% chance for " + get_polarized_number(def_debuff['def% buff (4)']) + "% DEF";
                    }
                    if (msg.length === 0) {
                        throw "Message length is 0";
                    }
                    msg += get_duration_and_target(effects);
                    return msg;
                    
                case '45': //bb/sbb/atk atk buff
                    msg += bb_atk_buff_handler(effects["bb atk% buff"], effects["sbb atk% buff"], effects["ubb atk% buff"]);

                    if (msg.length === 0) {
                        throw "Message length is 0";
                    }
                    msg += get_duration_and_target(effects["buff turns (72)"], effects["target area"], effects["target type"]);
                    return msg;
                    
                case '55': //ewd buff
                    msg += ewd_buff_handler(effects);
                    if (msg.length === 0) {
                        throw "Message length is 0";
                    }
                    msg += get_duration_and_target(effects["elemental weakness buff turns"], effects["target area"], effects["target type"]);
                    return msg;
                    
                case '23': //spark buff
                    msg += get_polarized_number(effects["spark dmg% buff (40)"]) + "% spark DMG";
                    
                    msg += get_duration_and_target(effects);
                    return msg;
                    
                case '54': //crit dmg buff
                    msg += get_polarized_number(effects["crit multiplier%"]) + "% crit DMG";
                    
                    msg += get_duration_and_target(effects["buff turns (84)"], effects["target area"], effects["target type"]);
                    return msg;
                    
                case '56': //AI chance buff
                    msg += effects["angel idol recover chance%"] + "% chance AI ";
                    msg += "(recovers " + effects["angel idol recover hp%"] + "% HP on proc)";
                    
                    msg += get_duration_and_target(effects["angel idol buff turns (91)"], effects["target area"], effects["target type"]);
                    return msg;
                    
                case '11': //ailment inflict
                    msg += ailment_inflict_handler(effects);
                    if (msg.length === 0) throw "Message length is 0";
                    return msg;
                case '19': //bc per turn
                    msg += effects["increase bb gauge gradual"] + " BC/turn";
                    
                    msg += get_duration_and_target(effects["increase bb gauge gradual turns (37)"], effects["target area"], effects["target type"]);
                    return msg;
                case '3': //heal over time
                    msg += get_formatted_minmax(effects["gradual heal low"], effects["gradual heal high"]) + " HP HoT";
                    msg += " (+" + effects["rec added% (from target)"] + "% target REC)";
                    
                    msg += get_duration_and_target(effects["gradual heal turns (8)"], effects["target area"], effects["target type"]);
                    return msg;
                case '85': //heal on hit
                    msg += effects["hp recover from dmg chance"] + "% chance to heal ";
                    msg += get_formatted_minmax(effects["hp recover from dmg% low"], effects["hp recover from dmg% high"]) + "% DMG when hit";
                    
                    msg += get_duration_and_target(effects["hp recover from dmg buff turns (133)"], effects["target area"], effects["target type"]);
                    return msg;
                case '44': //dot
                    msg += effects["dot atk%"] + "% DoT"
                    if(effects['dot flat atk'])
                        msg += ", +" + effects["dot flat atk"] + " flat ATK";
                    if(effects['dot dmg%'])
                        msg +=", +" + effects['dot dmg%'] + "% multiplier";
                    if (effects['dot element affected'] === false){
                        msg += " (EWD doesn't apply)";
                    }

                    msg += get_duration_and_target(effects["dot turns (71)"], effects["target area"], effects["target type"]);
                    return msg;
                case '2': //burst heal
                    msg += get_formatted_minmax(effects['heal low'],effects['heal high']) + " HP burst heal ";
                    msg += "(+" + effects['rec added% (from healer)'] + "% healer REC)";
                    if(damage_frames.hits > 1)
                        msg += " over " + damage_frames.hits + " hits";
                    msg += " (" + effects["target area"] + "," + effects["target type"] + ")";
                    return msg;
                case '24': //convert buff
                    // msg += "Convert " + effects['converted attribute'].toUpperCase() + " to ";
                    /*msg +=*/ var buff = adr_buff_handler(effects['atk% buff (46)'], effects['def% buff (47)'], effects['rec% buff (48)']);
                    msg += "Convert " + buff.replace('% ', "% " + effects['converted attribute'].toUpperCase().slice(0,3) + " to ");
                    msg += get_duration_and_target(effects["% converted turns"], effects["target area"], effects["target type"]);
                    return msg;
                default:
                    msg += "Proc ID " + id + " is not supported yet.";
                    return msg;
            }
        }catch(err){
            console.log(err);
            return "Proc ID " + id + " has an error.";
        }
    }else{
        id = effects["unknown proc id"];
    }
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
        msg += printBuffs(burst_effects.effects[i], burst_object["damage frames"][i], unit.element);
        if(i !== burst_effects.effects.length-1){
            msg += " / ";
        }
    }
    return msg;
}

//print all the materials needed for the given item id
function get_full_recipe(item_id){
    function full_recipe_recursive(item_id_arr, mat_acc, callbackFn){
        if(item_id_arr.length === 0){
            callbackFn(mat_acc);
        }else{
            if(mat_acc === undefined){
                mat_acc = {
                    result_id: [],
                    result_str: [],
                    counts: []
                };
            }
            var curItemObject = item_id_arr.shift();
            // console.log(curItemObject);
            var curItemQty = curItemObject.count;
            var curItemID = curItemObject.id;
            var index = mat_acc.result_id.indexOf(curItemID);
            if(index === -1){//item not in list yet
                client.getItem(curItemID)
                    .then(function(item){
                        if(item.recipe !== undefined && item.recipe.materials !== undefined){//we haven't reached the most basic item yet
                            // console.log(item.recipe.materials);
                            for(var m = 0; m < item.recipe.materials.length; ++m){
                                var curMat = item.recipe.materials[m];
                                var curMatIndex = mat_acc.result_id.indexOf(curMat.id);
                                if(curMatIndex === -1){ //not in list yet
                                    item_id_arr.push({
                                        id: curMat.id,
                                        count: curMat.count * curItemQty
                                    });
                                }else{
                                    mat_acc.counts[index] += curMat.count * curItemQty;
                                }
                            }//end for every material
                        }else if(item.id !== item_id){ //we've reached a base material
                            mat_acc.result_id.push(item.id);
                            mat_acc.result_str.push(item.name + " (" + item.id + ")");
                            mat_acc.counts.push(curItemQty);
                        }
                        full_recipe_recursive(item_id_arr,mat_acc, callbackFn);
                    });
            }else{ //item already in list, increment count for that item
                mat_acc.counts[index] += curItemQty;
                full_recipe_recursive(item_id_arr,mat_acc,callbackFn);
            }

        }//end else
    }
    return new Promise(function(fulfill,reject){
        full_recipe_recursive([{
            id: item_id,
            count: 1
        }],undefined,fulfill);
    });
}

var itemQuery = {
    item_name_id: "Muramasak",
    // rarity: 0,
    // strict: "true"
};

// client.searchItem(itemQuery)
//     .then(function(results){
//         if(results.length === 1){
//             // return client.getItem(result[0]);
//             return get_full_recipe(results[0]).then(function(result){
//                 var msg = "To make " + itemQuery.item_name_id + " you need:\n";
//                 for(var i = 0; i < result.result_str.length; ++i){
//                     var count = result.counts[i];
//                     var mat = result.result_str[i];
//                     msg += count + "x " + mat + "\n";
//                 }
//                 return msg;
//             });
//         }else{
//             return results;
//         }
//     })
//     .then(function (result) {
//         console.log(result);
//         // console.log(result.recipe.materials);
//     })
//     .catch(console.log);

function get_evo_line(unit_id) {
    function get_first_unit(unit_id) {
        return new Promise(function (fulfill, reject) {
            function get_unit_helper(unit_id, callbackFn) {
                client.getUnit(unit_id)
                    .then(function (result) {
                        if (result.prev === undefined) {
                            // console.log(result);
                            callbackFn(result.id);
                        }
                        else
                            get_unit_helper(result.prev, callbackFn);
                    });
            }
            get_unit_helper(unit_id, fulfill);
        });
    }

    function get_evo_helper(unit_id, evo_acc, callbackFn) {
        if (evo_acc === undefined)
            evo_acc = [];
        evo_acc.push(unit_id);
        client.getUnit(unit_id)
            .then(function (result) {
                if (result.next === undefined) {
                    callbackFn(evo_acc);
                } else {
                    return get_evo_helper(result.next, evo_acc, callbackFn);
                }
            });
    }

    return new Promise(function (fulfill, reject) {
        get_first_unit(unit_id).then(function(result){
            get_evo_helper(result,[],fulfill);
        });
    });
}


//print the entire evolution line of a unit (and materials)
function print_evo(unit){
    function print_evo_helper(unit_arr) {
        function print_recursive(unit_arr, acc, callbackFn) {
            if (unit_arr.length < 2) {
                callbackFn(acc);
            } else {
                var curUnit = unit_arr.shift();
                if (acc === undefined || acc.length === 0) {
                    acc = curUnit.name + " (" + curUnit.id + ") -> " + unit_arr[0].name + " (" + unit_arr[0].id + ")\n";
                }else{
                    acc += "\n" + curUnit.name + " (" + curUnit.id + ") -> " + unit_arr[0].name + " (" + unit_arr[0].id + ")\n";
                }

                acc += get_evo_mats(curUnit) + "\n";
                print_recursive(unit_arr, acc, callbackFn);
            }
        }
        return new Promise(function (fulfill, reject) {
            print_recursive(unit_arr, "", fulfill);
        });
    }

    function get_evo_mats(unit) {
        //count evo mats for duplicates
        var mats = [];
        var count = [];
        mats.push(unit.evo_mats[0].name + " (" + unit.evo_mats[0].id + ")");
        count.push(1);
        for (var mat = 1; mat < unit.evo_mats.length; ++mat) {
            var formatted = unit.evo_mats[mat].name + " (" + unit.evo_mats[mat].id + ")";
            var index = mats.indexOf(formatted);
            if (index === -1) {
                mats.push(formatted);
                count.push(1);
            } else {
                count[index]++;
            }
        }

        //convert to string
        var msg = "";
        for (var i = 0; i < mats.length; ++i) {
            if (count[i] > 1) {
                msg += count[i] + "x ";
            }
            msg += mats[i];
            if (i < mats.length - 1) {
                msg += ", ";
            }
        }

        return msg;
    }

    return new Promise(function(fulfill,reject){
        get_evo_line(unit.id).then(function(result_arr){
            // console.log(result_arr);
            if(result_arr.length < 2){
                return "This unit does not have any evolutions.";
            }else{
                return client.getUnits(result_arr).then(print_evo_helper);
            }
        }).then(fulfill);
    });
}

var unitQuery = {
    unit_name_id: "neferet",
    strict: "false",
    // server: "GL",
    // rarity: 8
};

client.searchUnit(unitQuery)
    .then(function (result) {
        if(result.length === 1){
            return client.getUnit(result[0]).then(function(unit){
                var burst_type = "bb";
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
        console.log(result);
        // console.log(result.length);
    })
    .catch(console.log);
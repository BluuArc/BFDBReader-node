let BuffProcessor = require('./buff_processor.js');

function EffectPrinter(target, options) {
    options = options || {};
    const buff_processor = new BuffProcessor(options.unit_names, options.item_names,options);
    this.buff_processor = buff_processor;

    function debug_log(){
        if(options.verbose){
            for(let m of arguments){
                console.log(m);
            }
        }
    }

    function init(){
        return buff_processor.initializeNames();
    }
    this.init = init;

    function setTarget(target_new){
        if(target){
            delete target;
        }
        target = target_new;
    }
    this.setTarget = setTarget;

    //arr - array of effects
    //other_data_function - given an index, return the data for the other_data field, if any
    //returns a string of translated buffs
    function process_effects(effects, other_data_function) {
        let translated_buffs = [];
        let other_data;
        debug_log("EffectPrinter.process_effects: Received effects =>", effects);
        if (other_data_function) debug_log("EffectPrinter.process_effects: Other data looks like =>", other_data_function(0))
        for (let e = 0; e < effects.length; ++e) {
            if (other_data_function) other_data = other_data_function(e);
            let msg = buff_processor.print_buff(effects[e], other_data);
            if (translated_buffs.indexOf(msg) === -1) translated_buffs.push(msg);
            else console.log("ignored duplicate msg:", msg);
        }
        return translated_buffs.join(" / ");
    }
    this.process_effects = process_effects;
    //burst_type - bb, sbb, or ubb
    function printBurst(burst_type) {
        debug_log("EffectPrinter.printBurst: received", burst_type);
        let burst_object;
        if (typeof burst_type === "string") {
            if (!target) throw "No target specified";
            burst_object = target[burst_type];
        } else if (typeof burst_type === "object")
            burst_object = burst_type;
        else
            throw `Unknown input for burst_type ${burst_type}`;
        if (!burst_object) return `No ${burst_type.toUpperCase()} data found`;
        let numLevels = burst_object.levels.length, burst_effects = burst_object.levels[numLevels - 1].effects;
        if (burst_object.desc) debug_log(burst_object.desc);
        return process_effects(burst_effects, function (i) {
            return {
                damage_frames: burst_object["damage frames"][i],
                element: target.element
            }
        });
    }
    this.printBurst = printBurst;

    function printLS() {
        if (!target) throw "No target specified";
        let ls_object = target["leader skill"];
        if (!ls_object) return `No Leader Skill data found`;
        return process_effects(ls_object.effects);
    }
    this.printLS = printLS;

    //can specify a specifc ES object from es.json
    function printES(es_object) {
        if (!es_object) {
            if (!target) throw "No target specified";
            es_object = target["extra skill"];
            if (!es_object) return `No Extra Skill data found`;
        }

        debug_log(JSON.stringify(es_object, null, 2));
        return process_effects(es_object.effects);
    }
    this.printES = printES;

    function printSingleSP(skill_index) {
        let skill_obj;
        if (typeof skill_index === "object") {
            skill_obj = skill_index;
        } else {
            if (!target) throw "No target specified";
            if (target.skills) skill_obj = target.skills[skill_index];
        }

        if (!skill_obj) return "No SP data found";
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
        for (let f = 0; f < skill_arr.length; ++f) {
            let effect = skill_arr[f];
            for (let e in effect) {
                if (sp_effects[e]) {
                    sp_effects[e].push(effect[e]);
                } else {
                    debug_log("Unknown SP effect type", e);
                }
            }
        }

        //translate each effect
        let keys = Object.keys(sp_effects);
        for (let f in sp_effects) {
            let curEffects = sp_effects[f];
            if (curEffects.length > 0) {
                let msg_arr = process_effects(curEffects, function () {
                    return {
                        sp: true
                    }
                });
                sp_effects[f] = msg_arr;
            } else {
                delete sp_effects[f];
            }
        }

        //concatenate similar strings
        let msg = buff_processor.multi_param_buff_handler({
            values: [sp_effects['add to bb'], sp_effects['add to sbb'], sp_effects['add to ubb'], sp_effects['add to passive']],
            names: ['BB', 'SBB', 'UBB', 'ES'],
            prefix: function (arr) {
                return `Enhances ${arr.join("/")} with additional "`
            },
            suffix: function (arr) {
                return '"';
            }

        });

        if (sp_effects.passive) {
            if (msg.length > 0) {
                msg += ", "
            }
            msg += sp_effects.passive;
        }

        return {
            desc: skill_obj.skill.desc,
            translation: msg
        };

        // debug_log(sp_effects);
    }
    this.printSingleSP = printSingleSP;

    function printSP() {
        if (!target) throw "No target specified";
        let enhancements = target.skills;
        if (!enhancements) return ["No SP Enhancements found"];
        debug_log(JSON.stringify(enhancements, null, 2));
        let msg_arr = [];
        for (let e = 0; e < enhancements.length; ++e) {
            let curMsg = printSingleSP(enhancements[e]);
            msg_arr.push(curMsg);
        }
        return msg_arr;
    }
    this.printSP = printSP;

    function printItem(item) {
        var effects = item.effect.effect || item.effect;
        return process_effects(effects, function () {
            return {
                "target area": item.effect.target_area,
                "target type": item.effect.target_type
            }
        });
    }
    this.printItem = printItem;
}

module.exports = EffectPrinter;
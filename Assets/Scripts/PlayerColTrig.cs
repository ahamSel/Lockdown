using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PlayerColTrig : MonoBehaviour
{
    Dictionary<string, bool> powerupsCata = new Dictionary<string, bool>()
    {
        { "Health", PowerupsManager.healthPicked },
        { "Shield", PowerupsManager.shieldPicked },
        { "Timex2", PowerupsManager.doubleTimePicked },
        { "Time/2", PowerupsManager.halveTimePicked },
        { "Raze", PowerupsManager.razePicked },
        { "Fire", PowerupsManager.firePicked },
        { "Shrink", PowerupsManager.shrinkPicked },
        { "Grow", PowerupsManager.growPicked },
        { "SpeedUp", PowerupsManager.speedUpPicked },
        { "SlowDown", PowerupsManager.slowDownPicked },
    };

    public static int hp = 5;

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }

    private void OnTriggerEnter2D(Collider2D trig)
    {
        powerupsCata[trig.name] = true;
        PowerupsManager.effectTime += 5f;
    }
}

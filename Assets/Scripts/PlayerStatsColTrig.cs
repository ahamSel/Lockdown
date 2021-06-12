using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PlayerStatsColTrig : MonoBehaviour
{
    private Dictionary<string, Action<Color>> powerupsCata;
    public float shieldTime, fireTime, doubleTimeTime, halveTimeTime, shrinkTime, growTime, speedUpTime, slowDownTime;
    public bool shieldOn, fireOn;

    public int playerHealth = 10;

    private PlayerMvt playerMvt;

    private Color playerColor;

    // Start is called before the first frame update
    void Start()
    {
        playerMvt = GetComponent<PlayerMvt>();

        playerColor = GetComponent<SpriteRenderer>().color;

        powerupsCata = new Dictionary<string, Action<Color>>()
        {
            { "Health", IncreasePlayerHealth },
            { "Shield", ShieldPlayer },
            { "Timex2", DoubleTimeSpeed },
            { "Time/2", HalveTimeSpeed },
            { "Raze", RazeMostBullets },
            { "Fire", PlayerBurnsBullets },
            { "Shrink", ShrinkPlayer },
            { "Grow", GrowPlayer },
            { "SpeedUp", SpeedUpPlayer },
            { "SlowDown", SlowDownPlayer },
        };
    }

    // Update is called once per frame
    void Update()
    {
        if (playerHealth < 1) Destroy(gameObject);
    }

    private void FixedUpdate()
    {
        if (shieldTime > 0) shieldTime -= Time.deltaTime;
        else if (shieldTime < 0) ShieldOff();
         
        if (fireTime > 0) fireTime -= Time.deltaTime;
        else if (fireTime < 0) FireOff();

        if (doubleTimeTime > 0) doubleTimeTime -= Time.deltaTime;
        else if (doubleTimeTime < 0) NormalTimeSpeed();

        if (halveTimeTime > 0) halveTimeTime -= Time.deltaTime;
        else if (halveTimeTime < 0) NormalTimeSpeed();

        if (speedUpTime > 0) speedUpTime -= Time.deltaTime;
        else if (speedUpTime < 0) NormalPlayerSpeed();

        if (slowDownTime > 0) slowDownTime -= Time.deltaTime;
        else if (slowDownTime < 0) NormalPlayerSpeed();

        if (growTime > 0) growTime -= Time.deltaTime;
        else if (growTime < 0) NormalPlayerSize();

        if (shrinkTime > 0) shrinkTime -= Time.deltaTime;
        else if (shrinkTime < 0) NormalPlayerSize();
    }

    private void OnCollisionEnter2D(Collision2D col)
    {
        if (col.gameObject.CompareTag("Bullet"))
        {
            if (fireOn) Destroy(col.gameObject);
            if (!fireOn && !shieldOn) playerHealth--;
        }
    }

    private void OnTriggerEnter2D(Collider2D trig)
    {
        powerupsCata[trig.name](trig.GetComponent<SpriteRenderer>().color);
    }

    void IncreasePlayerHealth(Color powerupColor)
    {
        playerHealth += 5;
    }

    void ShieldPlayer(Color powerupColor)
    {
        fireOn = false; fireTime = 0;
        shieldOn = true;
        shieldTime = (5f + shieldTime) * Time.timeScale;

        GetComponent<SpriteRenderer>().color = powerupColor;
    }

    void DoubleTimeSpeed(Color powerupColor)
    {
        halveTimeTime = 0;
        Time.timeScale = 2f;
        Time.fixedDeltaTime = Time.timeScale * 0.02f;
        doubleTimeTime = (5f + doubleTimeTime) * Time.timeScale;

        // Update all other powerups times
        shieldTime *= Time.timeScale;
        fireTime *= Time.timeScale;
        growTime *= Time.timeScale;
        shrinkTime *= Time.timeScale;
        speedUpTime *= Time.timeScale;
        slowDownTime *= Time.timeScale;

        playerMvt.moveSpeed = 10f / Time.timeScale;

        GetComponent<SpriteRenderer>().color = powerupColor;
    }
    void HalveTimeSpeed(Color powerupColor)
    {
        doubleTimeTime = 0;
        Time.timeScale = 0.1f;
        Time.fixedDeltaTime = Time.timeScale * 0.02f;
        halveTimeTime = (5f + halveTimeTime) * Time.timeScale;

        // Update all other powerups times
        shieldTime *= Time.timeScale;
        fireTime *= Time.timeScale;
        growTime *= Time.timeScale;
        shrinkTime *= Time.timeScale;
        speedUpTime *= Time.timeScale;
        slowDownTime *= Time.timeScale;

        playerMvt.moveSpeed = 10f / Time.timeScale;

        GetComponent<SpriteRenderer>().color = powerupColor;
    }

    void RazeMostBullets(Color powerupColor)
    {
        GameObject[] bullets = GameObject.FindGameObjectsWithTag("Bullet");
        for (int i = 3; i < bullets.Length; i++)
            Destroy(bullets[i]);
    }

    void PlayerBurnsBullets(Color powerupColor)
    {
        shieldOn = false; shieldTime = 0;
        fireOn = true;
        fireTime = (5f + fireTime) * Time.timeScale;

        GetComponent<SpriteRenderer>().color = powerupColor;
    }

    void ShrinkPlayer(Color powerupColor)
    {
        growTime = 0;
        transform.localScale = new Vector2(0.2f, 0.2f);
        shrinkTime = (5f + shrinkTime) * Time.timeScale;

        GetComponent<SpriteRenderer>().color = powerupColor;
    }
    void GrowPlayer(Color powerupColor)
    {
        shrinkTime = 0;
        transform.localScale = new Vector2(0.8f, 0.8f);
        growTime = (5f + growTime) * Time.timeScale;
        
        GetComponent<SpriteRenderer>().color = powerupColor;
    }

    void SpeedUpPlayer(Color powerupColor)
    {
        slowDownTime = 0;
        playerMvt.moveSpeed = 15f / Time.timeScale;
        speedUpTime = (5f + speedUpTime) * Time.timeScale;

        GetComponent<SpriteRenderer>().color = powerupColor;
    }
    void SlowDownPlayer(Color powerupColor)
    {
        speedUpTime = 0;
        playerMvt.moveSpeed = 5f / Time.timeScale;
        slowDownTime = (5f + slowDownTime) * Time.timeScale;

        GetComponent<SpriteRenderer>().color = powerupColor;
    }

    public void ShieldOff() {
        shieldOn = false;
        shieldTime = 0;
        GetComponent<SpriteRenderer>().color = playerColor;
        Debug.Log("shieldOff");
    }
    public void FireOff() {
        fireOn = false;
        fireTime = 0;
        GetComponent<SpriteRenderer>().color = playerColor;
        Debug.Log("fireOff");
    }
    public void NormalPlayerSpeed() {
        playerMvt.moveSpeed = 10f / Time.timeScale;
        speedUpTime = 0;
        slowDownTime = 0;
        GetComponent<SpriteRenderer>().color = playerColor;
        Debug.Log("playerSpeed");
    }
    public void NormalPlayerSize() {
        transform.localScale = new Vector2(0.5f, 0.5f);
        growTime = 0;
        shrinkTime = 0;
        GetComponent<SpriteRenderer>().color = playerColor;
        Debug.Log("playerSize");
    }
    public void NormalTimeSpeed() {
        Time.timeScale = 1f;
        Time.fixedDeltaTime = 0.02f;
        NormalPlayerSpeed();
        doubleTimeTime = 0;
        halveTimeTime = 0;
        GetComponent<SpriteRenderer>().color = playerColor;
        Debug.Log("timeSpeed");
    }
}

using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

public class UIScript : MonoBehaviour
{
    public GameObject pausePanel;
    public PlayerCollisions playerColStats;
    public BulletBehaviour bulletBehave;
    public Text healthText, scoreText, bestScoreText;
    
    float keepTimeSpeed;
    public int score = 1;
    public static int bulletCount = 1;

    private void Start()
    {
        bulletCount = 1;
    }

    // Update is called once per frame
    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Escape))
            if (Time.timeScale != 0f) PauseGame();
            else ResumeGame();

        healthText.text = $"HP : {playerColStats.playerHealth}";
        scoreText.text = $"{score}";

        if (PlayerPrefs.GetInt("BestScore", 0) < score) PlayerPrefs.SetInt("BestScore", score);
        bestScoreText.text = $"Best Score: {PlayerPrefs.GetInt("BestScore")}";

        Debug.Log(bulletCount);
    }

    public void PauseGame()
    {
        keepTimeSpeed = Time.timeScale;
        Time.timeScale = 0f;
        pausePanel.SetActive(true);
    }

    public void ResumeGame()
    {
        Time.timeScale = keepTimeSpeed;
        pausePanel.SetActive(false);
    }

    public void ExitToStart() 
    {
        Time.timeScale = 1f;
        Time.fixedDeltaTime = 0.02f;
        SceneManager.LoadScene("Start");
    } 
}
